import { usePortalCopy } from './copy';
import { majorLabel, ZUJ } from './profile-fields';
import { academicYearLabel } from './academic-years';
import type { Row } from './data';

export function ProfileDetails({ profile }: { profile: Row<'profiles'> }) {
  const { c, arabic } = usePortalCopy();
  return (
    <dl className="profile-details">
      {[
        [c.fullName, profile.full_name],
        [c.email, profile.email],
        [c.whatsapp, profile.whatsapp],
        [c.university, profile.university === ZUJ ? c.zuj : profile.university],
        [c.major, majorLabel(profile.major, arabic)],
        [c.year, profile.academic_year ? academicYearLabel(profile.academic_year, arabic) : null],
        [
          c.python,
          profile.python_experience === 'none'
            ? c.none
            : profile.python_experience === 'basic'
              ? c.basic
              : profile.python_experience === 'experienced'
                ? c.experienced
                : null,
        ],
        [c.universityId, profile.university_id],
        [c.preferredLanguage, profile.locale === 'ar' ? c.arabicLanguage : c.englishLanguage],
      ].map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd dir="auto">{value || c.notProvided}</dd>
        </div>
      ))}
    </dl>
  );
}
