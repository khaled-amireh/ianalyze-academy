import { Link } from 'react-router';
import { PageContainer } from '@/components/shared/page-container';
import { privacyApproved } from '@/lib/academy-client';
import { usePortalCopy } from './copy';
export function PrivacyPage() {
  const { c, arabic } = usePortalCopy();
  return (
    <PageContainer className="portal-page">
      <h1 id="page-title" tabIndex={-1}>
        {c.privacy}
      </h1>
      {!privacyApproved && <p className="portal-draft">{c.draft}</p>}
      {arabic ? (
        <section className="content-card" lang="ar" dir="rtl">
          <p>
            يوضح هذا الإشعار استخدام بيانات الحساب والتسجيل في أكاديمية iAnalyze، أحد الأندية
            التابعة لـ iTeam في جامعة الزيتونة الأردنية.
          </p>
          <h2>البيانات والغرض منها</h2>
          <p>
            نجمع اسم الجامعة واللغة المفضلة والبريد الإلكتروني والاسم والتخصص والسنة الدراسية
            والخبرة في Python ورقم WhatsApp لإدارة الحساب والمشاركة والتواصل حول التدريب. الرقم
            الجامعي مطلوب لطلبة جامعة الزيتونة الأردنية فقط، واختياري لغيرهم، ويُستخدم للتحقق من
            التسجيل ومنع تكراره. لا يُنشر للعامة. تعالج خدمة Supabase بيانات المصادقة وكلمة المرور
            بأمان؛ لا تُعرض كلمة المرور للفريق.
          </p>
          <h2>التسليمات والدرجات</h2>
          <p>
            تُحفظ دفاتر العمل ومعلومات التسليم والدرجات والملاحظات في مساحة خاصة. يرى الطالب سجلاته
            فقط. يستطيع أعضاء الفريق المخولون مراجعة بيانات التسجيل، بما فيها الجامعة والرقم
            الجامعي، وأرقام WhatsApp والتسليمات وتقييمها. لا تنفذ المنصة شيفرة الدفاتر ولا تعرض
            مخرجاتها كمحتوى نشط.
          </p>
          <h2>الترتيب العام</h2>
          <p>
            يستخدم الترتيب الدرجات المنشورة فقط ويعرض أسماء مستعارة مولدة، دون البريد أو واتساب أو
            الرقم الجامعي أو الاسم الحقيقي. لن يُنشر الاسم الحقيقي دون موافقة مستقلة صريحة. لا تتضمن
            الموافقة على التسجيل موافقة على نشر الاسم.
          </p>
          <h2>الخدمات الخارجية والحماية</h2>
          <p>
            تعتمد المنصة على Supabase للمصادقة وقاعدة البيانات والتخزين، وعلى Cloudflare للاستضافة،
            وعلى مزود بريد معتمد لرسائل الحساب. قد تتضمن رسائل البريد عنوانك وروابط تأكيد أو استعادة
            سرية. نحفظ حالة قراءة الإشعارات لحسابك؛ وتشمل الإعلانات والأنشطة المنشورة والمواعيد
            وتحديثات تسليماتك. لا نرسل إشعارات عبر المتصفح أو بريدًا آليًا للإشعارات. لا تشارك هذه
            الروابط. يحفظ خيار «تذكرني» الجلسة بين مرات تشغيل المتصفح عند دعمه. دون هذا الخيار ترتبط
            الجلسة بعلامة التبويب أو جلسة المتصفح، وقد يحتفظ بها استرجاع جلسة المتصفح. لا يحفظ
            التطبيق كلمة المرور؛ سجل الخروج عند استخدام جهاز مشترك.
          </p>
          <h2>الاحتفاظ والحقوق</h2>
          <p>
            تُحفظ بيانات الحساب والتسجيل لإدارة المشاركة والتقييم في الأكاديمية. لطلب الوصول أو
            التصحيح أو الحذف، تواصل مع الفريق عبر صفحة التواصل. يراجع الفريق الطلب ويشرح أي حاجة
            للاحتفاظ بسجلات التقييم؛ لا تُحذف التسليمات المراجعة تلقائيًا.
          </p>
          <h2>موافقة التسجيل</h2>
          <p>
            يُسجل إصدار الموافقة ووقتها في الخادم بعد تأكيد البريد وإكمال الملف. يحصل الطلاب على
            صلاحية المشاركة مباشرة بعد اكتمال التسجيل دون انتظار موافقة قائد. يقتصر الاطلاع على
            أرقام WhatsApp والبيانات الخاصة على صاحب الحساب والفريق المخول.
          </p>
        </section>
      ) : (
        <section className="content-card" lang="en" dir="ltr">
          <p>
            This notice explains how iAnalyze Academy, a club under iTeam at Al-Zaytoonah University
            of Jordan, uses account and registration information.
          </p>
          <h2>Data and purpose</h2>
          <p>
            We collect email, name, major, academic year, Python experience and WhatsApp number to
            manage accounts, participation and training communications. We also collect university
            and preferred language. University ID is required only for Al-Zaytoonah University of
            Jordan students, optional for others, and used to prevent duplicate registration. It is
            never public. Supabase securely handles authentication and passwords; Team members
            cannot view passwords.
          </p>
          <h2>Submissions and grades</h2>
          <p>
            Notebook files, submission metadata, grades and feedback are private. Students can view
            their own private records. Authorized Team members can review registration details
            (including university and University ID), WhatsApp numbers, notebooks and grading
            records. The platform does not execute notebook code or render notebook outputs as
            active content.
          </p>
          <h2>Public rankings</h2>
          <p>
            Rankings use published grades and generated pseudonyms only. They do not return email,
            WhatsApp, university ID or real names. Real-name display requires separate explicit
            consent; registration consent does not authorize it.
          </p>
          <h2>Providers and safeguards</h2>
          <p>
            The platform uses Supabase for Auth, database and Storage, Cloudflare for hosting, and
            an approved email provider for account messages. Emails may contain your address and
            confidential confirmation/recovery links. In-app notification read receipts are stored
            for your account; notifications include published announcements, activities, deadlines
            and your submission updates. No browser push or automatic notification emails are sent.
            Do not share those links. Remember Me stores your session across browser restarts where
            supported. Otherwise it is scoped to the browser tab/session; browser session
            restoration may retain it. Passwords are never stored by the app; log out on shared
            devices.
          </p>
          <h2>Retention and requests</h2>
          <p>
            Account and registration records are retained for academy participation and assessment
            administration. Contact the Team through the contact page to request access, corrections
            or deletion. The Team reviews the request and explains any need to retain assessment
            records. Reviewed submissions are not automatically deleted.
          </p>
          <h2>Registration consent</h2>
          <p>
            The server records the consent version and time after email verification and profile
            completion. Students receive access immediately after registration, without Leader
            approval. Private contact details are accessible only to the account holder and
            authorized Team members.
          </p>
        </section>
      )}
      <Link to="/contact">{arabic ? 'التواصل مع الفريق' : 'Contact the Team'}</Link>
    </PageContainer>
  );
}
