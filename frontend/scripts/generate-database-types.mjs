import { writeFileSync, readFileSync } from 'node:fs';
import { createDatabase } from './database-fixture.mjs';

const db = await createDatabase();
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
  const output = `// Generated from the migration catalog by npm run db:types. Do not edit.\n// Embedded PostgreSQL fixture; hosted Supabase CLI generation remains a later check.\nexport type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];\nexport type Database = {\n  public: {\n    Tables: {\n${tableTypes}\n    };\n    Views: { [_ in never]: never };\n    Functions: {\n      current_academy_role: { Args: Record<string, never>; Returns: string | null };\n      complete_registration: { Args: { p_consent_version: string }; Returns: undefined };\n      save_grade: { Args: { p_submission_id: string; p_scores: Json; p_feedback: string; p_publish: boolean; p_expected_revision: number }; Returns: string };\n    };\n    Enums: { [_ in never]: never };\n    CompositeTypes: { [_ in never]: never };\n  };\n};\n`;
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
    console.log('Database types match migration catalog.');
  } else {
    writeFileSync(path, formatted);
    console.log('Database types generated from local migration catalog.');
  }
} finally {
  await db.close();
}
