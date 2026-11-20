import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { browser } from '../scripts/pre-presentation-browser-client.mjs';

test(
  'isolated GoTrue/PostgREST and authenticated Chrome consent/Admin release',
  { skip: process.env.RELEASE_LOCAL_TESTS !== '1', timeout: 150000 },
  async (t) => {
    assert.equal(new URL(process.env.LOCAL_SUPABASE_URL).origin, 'http://127.0.0.1:55431');
    const dbTarget = new URL(process.env.LOCAL_SUPABASE_DB_URL);
    assert.equal(dbTarget.hostname, '127.0.0.1');
    assert.equal(dbTarget.port, '55432');
    const sql = postgres(process.env.LOCAL_SUPABASE_DB_URL, { max: 1 });
    t.after(() => sql.end());
    const options = { auth: { persistSession: false, autoRefreshToken: false } };
    const create = (key) => createClient(process.env.LOCAL_SUPABASE_URL, key, options);
    const service = create(process.env.LOCAL_SUPABASE_SECRET_KEY);
    const users = [];
    for (const role of ['admin', 'student', 'team']) {
      const email = `release-${role}-${randomUUID()}@example.test`,
        password = randomUUID() + 'Az9!';
      const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
      assert.ifError(created.error);
      const api = create(process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY);
      assert.ifError((await api.auth.signInWithPassword({ email, password })).error);
      const id = created.data.user.id;
      assert.ifError(
        (
          await api
            .from('profiles')
            .update({
              full_name: `Release ${role} ${id.slice(0, 8)}`,
              whatsapp: '+962790000001',
              major: 'Data',
              academic_year: 2,
              python_experience: 'basic',
              locale: 'en',
              university: 'Other',
            })
            .eq('id', id)
        ).error,
      );
      assert.ifError(
        (await api.rpc('complete_registration', { p_consent_version: 'registration-v1' })).error,
      );
      if (role === 'team')
        await sql`update app_private.user_roles set role='team',grant_reason='isolated fixture' where user_id=${id}`;
      if (role === 'admin')
        await sql`insert into app_private.application_admins(user_id,grant_reason) values(${id},'isolated fixture')`;
      users.push({ role, email, password, id, api, name: `Release ${role} ${id.slice(0, 8)}` });
    }
    const admin = users[0],
      student = users[1],
      team = users[2];
    t.after(async () => {
      for (const user of users) await user.api.auth.signOut();
    });
    await t.test(
      'real authenticated consent publish/withdraw and private-field protection',
      async () => {
        assert.ifError(
          (await student.api.rpc('set_public_full_name_consent', { p_consented: true })).error,
        );
        let ranking = await student.api.rpc('academy_rankings', { p_view: 'all', p_week: null });
        assert.ifError(ranking.error);
        assert.ok(ranking.data.rows.some((row) => row.alias === student.name));
        assert.ifError(
          (await student.api.rpc('set_public_full_name_consent', { p_consented: false })).error,
        );
        ranking = await student.api.rpc('academy_rankings', { p_view: 'all', p_week: null });
        assert.ok(!ranking.data.rows.some((row) => row.alias === student.name));
        assert.ok(
          (
            await student.api
              .from('profiles')
              .update({ full_name: 'Impersonation' })
              .eq('id', student.id)
          ).error,
        );
        const audit =
          await sql`select count(*)::int n from app_private.leaderboard_name_consent_events where student_id=${student.id}`;
        assert.equal(audit[0].n, 2);
      },
    );
    await t.test(
      'Admin-only idempotent audited awards and archived originals through real APIs',
      async () => {
        const request = {
          p_student: student.id,
          p_amount: 42,
          p_reason: 'Isolated release fixture',
          p_idempotency_key: randomUUID(),
        };
        for (const unauthorized of [student, team])
          assert.ok((await unauthorized.api.rpc('admin_award_points', request)).error);
        const result = await admin.api.rpc('admin_award_points', request);
        assert.ifError(result.error);
        const retry = await admin.api.rpc('admin_award_points', request);
        assert.ifError(retry.error);
        assert.equal(retry.data, result.data);
        assert.ok((await student.api.rpc('admin_point_award_history')).error);
        const history = await admin.api.rpc('admin_point_award_history', { p_student: student.id });
        assert.ifError(history.error);
        assert.equal(history.data.length, 1);
        assert.equal(history.data[0].amount, 42);
        const archive = (
          await sql`select app_private.rankings_at('archive', app_private.scoring_week(now()),
      app_private.scoring_start(app_private.scoring_week(now())+1)+interval '1 second') payload`
        )[0].payload;
        const alias = (
          await sql`select coalesce(leaderboard_name,'Learner '||substr(md5(id::text),1,10)) leaderboard_name from public.profiles where id=${student.id}`
        )[0].leaderboard_name;
        assert.equal(archive.rows.find((row) => row.alias === alias).original_points, 42);
      },
    );
    await t.test(
      'authenticated browser exposes consent to Student and awards only to Admin',
      async () => {
        const b = await browser('chrome', 9267);
        try {
          for (const user of [student, admin, team]) {
            await b.load('http://127.0.0.1:5197/login');
            await b.ev(`localStorage.clear();sessionStorage.clear();true`);
            await b.load('http://127.0.0.1:5197/login');
            await b.wait(`!!document.querySelector('input[type="email"]')`);
            await b.ev(`(() => { const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
          for(const [selector,value] of ${JSON.stringify([
            ['input[type="email"]', user.email],
            ['input[type="password"]', user.password],
          ])}) {
            const el=document.querySelector(selector); setter.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true})); }
          document.querySelector('input[type="password"]').form.requestSubmit();return true;})()`);
            await b.wait(`!location.pathname.includes('login')`);
            await b.load(
              'http://127.0.0.1:5197/' + (user.role === 'student' ? 'student' : 'workspace'),
            );
            if (user.role === 'student') {
              await b.wait(`!!document.querySelector('input[name="public_full_name_consent"]')`);
              assert.equal(await b.ev(`!!document.querySelector('#admin-awards-title')`), false);
              for (const expected of [true, false]) {
                await b.ev(
                  `(() => {const el=document.querySelector('input[name="public_full_name_consent"]');el.closest('details').open=true;el.click();el.form.requestSubmit();return true;})()`,
                );
                let observed = false;
                for (let n = 0; n < 100; n++) {
                  const profile = await student.api
                    .from('profiles')
                    .select('public_full_name_consent')
                    .eq('id', student.id)
                    .single();
                  if (!profile.error && profile.data.public_full_name_consent === expected) {
                    observed = true;
                    break;
                  }
                  await new Promise((r) => setTimeout(r, 100));
                }
                assert.equal(observed, true, 'Browser consent persisted through real API');
                await b.wait(
                  `!!document.querySelector('input[name="public_full_name_consent"]') && !document.querySelector('input[name="public_full_name_consent"]').disabled`,
                );
              }
            } else if (user.role === 'admin') {
              await b.wait(`!!document.querySelector('#admin-awards-title')`);
              await b.ev(
                `(() => {const search=document.querySelector('#admin-awards-title').closest('section').querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(search,${JSON.stringify(student.name)});search.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`,
              );
              await b.wait(
                `!!document.querySelector('#admin-awards-title').closest('section').querySelector('select option[value="${student.id}"]')`,
              );
              await b.ev(`(() => { const section=document.querySelector('#admin-awards-title').closest('section');
            const select=section.querySelector('select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,${JSON.stringify(student.id)});select.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
              await b.ev(`(() => {const form=document.querySelector('#admin-awards-title').closest('section').querySelector('form');
            const inputs=form.querySelectorAll('input');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
            for(const [i,value] of [[0,'7'],[1,'Synthetic browser award']]){setter.call(inputs[i],value);inputs[i].dispatchEvent(new Event('input',{bubbles:true}));}
            window.confirm=()=>true;form.requestSubmit();return true;})()`);
              let recorded = false;
              for (let n = 0; n < 100; n++) {
                const result = await admin.api.rpc('admin_point_award_history', {
                  p_student: student.id,
                });
                if (
                  !result.error &&
                  result.data.some(
                    (award) => award.reason === 'Synthetic browser award' && award.amount === 7,
                  )
                ) {
                  recorded = true;
                  break;
                }
                await new Promise((r) => setTimeout(r, 100));
              }
              assert.equal(recorded, true, 'Browser Admin award persisted through real RPC');
            } else {
              await new Promise((r) => setTimeout(r, 500));
              assert.equal(await b.ev(`!!document.querySelector('#admin-awards-title')`), false);
            }
          }
        } finally {
          await b.close();
        }
      },
    );
  },
);
