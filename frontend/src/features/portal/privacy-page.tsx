import { Link } from 'react-router';
import { PageContainer } from '@/components/shared/page-container';
import { privacyApproved } from '@/lib/academy-client';
import { usePortalCopy } from './copy';
export function PrivacyPage() {
  const { c, arabic } = usePortalCopy();
  return (
    <PageContainer className="portal-page">
      <h1>{c.privacy}</h1>
      {!privacyApproved && <p className="portal-draft">{c.draft}</p>}
      {arabic ? (
        <section className="content-card" lang="ar" dir="rtl">
          <p>
            هذه مسودة إشعار الخصوصية لأكاديمية iAnalyze، إحدى مبادرات iTeam. لا تمثل سياسة معتمدة
            قبل مراجعة المالك وفتح التسجيل رسميًا.
          </p>
          <h2>البيانات والغرض منها</h2>
          <p>
            نجمع البريد الإلكتروني والاسم والتخصص والسنة الدراسية والخبرة في بايثون ورقم واتساب
            لإدارة الحساب والمشاركة والتواصل حول التدريب. الرقم الجامعي اختياري. تعالج خدمة Supabase
            بيانات المصادقة وكلمة المرور بأمان؛ لا تُعرض كلمة المرور للفريق.
          </p>
          <h2>التسليمات والدرجات</h2>
          <p>
            تُحفظ دفاتر العمل ومعلومات التسليم والدرجات والملاحظات في مساحة خاصة. يرى الطالب سجلاته
            فقط. يستطيع أعضاء الفريق المخولون مراجعة بيانات المسجلين وأرقام واتساب والتسليمات
            وتقييمها. لا تنفذ المنصة شيفرة الدفاتر ولا تعرض مخرجاتها كمحتوى نشط.
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
            سرية. لا تشارك هذه الروابط. تحفظ الجلسة محليًا على جهازك؛ سجل الخروج عند استخدام جهاز
            مشترك.
          </p>
          <h2>الاحتفاظ والحقوق</h2>
          <p>
            لا تُحذف التسليمات المراجعة تلقائيًا. يجب اعتماد فترة الاحتفاظ وإجراءات التصحيح والحذف
            قبل الإطلاق. لطلب الوصول أو التصحيح أو مناقشة الحذف، تواصل مع الفريق عبر صفحة التواصل.
            قد يرتبط الحذف بالتزامات الاحتفاظ بسجل التقييم التي يجب توضيحها في النسخة النهائية.
          </p>
          <h2>موافقة التسجيل</h2>
          <p>
            يُسجل إصدار الموافقة ووقتها في الخادم بعد التحقق من البريد وإكمال الملف. لا يُفتح
            التسجيل قبل اعتماد هذه المسودة، جهة التواصل، فترة الاحتفاظ، أهلية الأعمار وإجراءات طلبات
            الخصوصية.
          </p>
        </section>
      ) : (
        <section className="content-card" lang="en" dir="ltr">
          <p>
            This is a draft privacy notice for iAnalyze Academy, an iTeam initiative. It becomes an
            approved policy only after owner review and an explicit registration launch decision.
          </p>
          <h2>Data and purpose</h2>
          <p>
            We collect email, name, major, academic year, Python experience and WhatsApp number to
            manage accounts, participation and training communications. University ID is optional.
            Supabase securely handles authentication and passwords; Team members cannot view
            passwords.
          </p>
          <h2>Submissions and grades</h2>
          <p>
            Notebook files, submission metadata, grades and feedback are private. Students can view
            their own private records. Authorized Team members can review registered participants,
            WhatsApp numbers, notebooks and grading records. The platform does not execute notebook
            code or render notebook outputs as active content.
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
            confidential confirmation/recovery links. Do not share those links. Sessions are stored
            locally on your device; log out on shared devices.
          </p>
          <h2>Retention and requests</h2>
          <p>
            Reviewed submissions are not automatically deleted. The owner must approve retention
            periods and correction/erasure procedures before launch. Contact the Team through the
            contact page to request access, corrections or discuss deletion. Any need to retain
            assessment records must be explained in the final policy.
          </p>
          <h2>Registration consent</h2>
          <p>
            The server records the consent version and time after email verification and profile
            completion. Registration stays closed until this draft, the responsible contact,
            retention period, age eligibility and privacy request procedure are approved.
          </p>
        </section>
      )}
      <Link to="/contact">{arabic ? 'التواصل مع الفريق' : 'Contact the Team'}</Link>
    </PageContainer>
  );
}
