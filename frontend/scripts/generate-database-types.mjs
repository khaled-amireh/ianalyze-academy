import { writeFileSync, readFileSync } from 'node:fs';
import { createDatabase } from './database-fixture.mjs';
import { localTestTarget } from './local-test-target.mjs';

const live = process.argv.includes('--local');
let db;
if (live) {
  const { default: postgres } = await import('postgres');
  const sql = postgres(localTestTarget(process.env.LOCAL_SUPABASE_DB_URL, 'database'), {
    max: 1,
    connect_timeout: 5,
  });
  db = { query: async (query) => ({ rows: await sql.unsafe(query) }), close: () => sql.end() };
} else db = await createDatabase();
try {
  const { rows } = await db.query(`
    select table_name, column_name, data_type, is_nullable, column_default,
      is_identity, is_generated
    from information_schema.columns
    where table_schema = 'public' order by table_name, ordinal_position
  `);
  const tables = Object.groupBy(rows, (row) => row.table_name);
  const { rows: relations } = await db.query(`
    select c.conname as name, src.relname as table_name, target.relname as target,
      array(select a.attname from unnest(c.conkey) with ordinality k(num, ord)
        join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.num order by k.ord) as columns,
      array(select a.attname from unnest(c.confkey) with ordinality k(num, ord)
        join pg_attribute a on a.attrelid=c.confrelid and a.attnum=k.num order by k.ord) as target_columns,
      exists(select 1 from pg_constraint u where u.conrelid=c.conrelid and u.contype in ('p','u') and u.conkey=c.conkey) as one_to_one
    from pg_constraint c join pg_class src on src.oid=c.conrelid
      join pg_class target on target.oid=c.confrelid
      join pg_namespace sn on sn.oid=src.relnamespace
      join pg_namespace tn on tn.oid=target.relnamespace
    where c.contype='f' and sn.nspname='public' and tn.nspname='public' order by c.conname
  `);
  const type = (row) => {
    const base = /^(smallint|integer|bigint|numeric|real|double precision)$/.test(row.data_type)
      ? 'number'
      : row.data_type === 'boolean'
        ? 'boolean'
        : row.data_type === 'jsonb'
          ? 'Json'
          : 'string';
    return base + (row.is_nullable === 'YES' ? ' | null' : '');
  };
  const tableTypes = Object.entries(tables)
    .map(([name, columns]) => {
      const fields = (mode) =>
        columns
          .map((column) => {
            const generated = column.is_generated === 'ALWAYS' || column.is_identity === 'YES';
            const optional =
              mode !== 'Row' &&
              (mode === 'Update' ||
                generated ||
                column.column_default !== null ||
                column.is_nullable === 'YES');
            return `        ${column.column_name}${optional ? '?' : ''}: ${mode !== 'Row' && generated ? 'never' : type(column)};`;
          })
          .join('\n');
      const relationships = relations
        .filter((r) => r.table_name === name)
        .map((r) => ({
          foreignKeyName: r.name,
          columns: r.columns,
          isOneToOne: r.one_to_one,
          referencedRelation: r.target,
          referencedColumns: r.target_columns,
        }));
      return `    ${name}: {\n      Row: {\n${fields('Row')}\n      };\n      Insert: {\n${fields('Insert')}\n      };\n      Update: {\n${fields('Update')}\n      };\n      Relationships: ${JSON.stringify(relationships)};\n    };`;
    })
    .join('\n');
  const { rows: functions } = await db.query(`
    select p.proname as name, pg_get_function_result(p.oid) as result,
      p.pronargdefaults as defaults,
      coalesce((select jsonb_agg(jsonb_build_object('name', p.proargnames[a.ordinality],
        'type', format_type(a.type, null)) order by a.ordinality)
        from unnest(p.proargtypes) with ordinality a(type, ordinality)), '[]'::jsonb) as arguments
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f'
      and p.prorettype not in ('trigger'::regtype, 'event_trigger'::regtype)
    order by p.proname
  `);
  const sqlType = (name) => {
    if (['uuid', 'text', 'character varying'].includes(name)) return 'string';
    if (['smallint', 'integer', 'bigint', 'numeric', 'real', 'double precision'].includes(name))
      return 'number';
    if (name === 'boolean') return 'boolean';
    if (name === 'json' || name === 'jsonb') return 'Json';
    if (name === 'void') return 'undefined';
    throw new Error(`Unsupported RPC catalog type requires review: ${name}`);
  };
  if (new Set(functions.map((fn) => fn.name)).size !== functions.length)
    throw new Error('Overloaded public RPCs require an explicit type review');
  const functionTypes = functions
    .map((fn) => {
      const args = fn.arguments.length
        ? `{ ${fn.arguments
            .map((arg, index) => {
              if (!arg.name) throw new Error(`Named RPC argument required: ${fn.name}`);
              return `${arg.name}${index >= fn.arguments.length - fn.defaults ? '?' : ''}: ${sqlType(arg.type)}`;
            })
            .join('; ')} }`
        : 'Record<string, never>';
      // PostgreSQL does not describe scalar function nullability; this role RPC denies
      // unverified/unknown identities by returning NULL, so retain its conservative type.
      const result = sqlType(fn.result) + (fn.name === 'current_academy_role' ? ' | null' : '');
      return `      ${fn.name}: { Args: ${args}; Returns: ${result} };`;
    })
    .join('\n');
  const output = `// Generated from the migration catalog by npm run db:types. Do not edit.\n// PostgreSQL tables, relationships and RPC catalog; verify live local schema with check:database-types:local.\nexport type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];\nexport type Database = {\n  public: {\n    Tables: {\n${tableTypes}\n    };\n    Views: { [_ in never]: never };\n    Functions: {\n${functionTypes}\n    };\n    Enums: { [_ in never]: never };\n    CompositeTypes: { [_ in never]: never };\n  };\n};\n`;
  const { format } = await import('prettier');
  const formatted = await format(output, {
    parser: 'typescript',
    singleQuote: true,
    trailingComma: 'all',
    printWidth: 100,
  });
  const path = new URL('../src/types/database.ts', import.meta.url);
  if (process.argv.includes('--check')) {
    if (readFileSync(path, 'utf8') !== formatted)
      throw new Error('Database types drifted; run npm run db:types');
    console.log(
      `Database tables, relationships and RPC types match the ${live ? 'real local Supabase' : 'embedded migration'} catalog.`,
    );
  } else {
    writeFileSync(path, formatted);
    console.log('Database types generated from local migration catalog.');
  }
} finally {
  await db.close();
}
