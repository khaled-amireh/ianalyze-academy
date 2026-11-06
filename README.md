<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="frontend/src/assets/brand/ianalyze-on-dark.png">
    <img src="frontend/src/assets/brand/ianalyze-on-light.png" alt="iAnalyze Academy — AI & DS Club, an iTEAM initiative" width="420">
  </picture>
</p>

# iAnalyze Academy

A bilingual learning platform for aspiring data analysts, built as an iAnalyze initiative under iTEAM at Al-Zaytoonah University of Jordan.

**[🌐 Visit Live Website](https://ianalyze-academy.pages.dev/)** · [GitHub Repository](https://github.com/khaled-amireh/ianalyze-academy)

## About the project

iAnalyze Academy helps students explore data analysis through accessible learning resources, structured guidance, and a collaborative academic community. It brings together the educational work of iAnalyze, an initiative under iTEAM at Al-Zaytoonah University of Jordan, in one bilingual platform.

## Key features

### Public learning experience

- **Arabic and English:** translated content with RTL/LTR text handling. The approved layout keeps its RTL structure across languages while English text reads left to right.
- **Responsive design and themes:** mobile-friendly layouts, light/dark themes, and saved language and theme preferences.
- **EDA learning resources:** course information, preparation guidance, and study-plan content for Exploratory Data Analysis. The detailed week-by-week plan is implemented but currently hidden on the public course page.
- **AI Tools Hub:** beginner-friendly guides for Google Colab, Python, Visual Studio Code, Kaggle, and Power BI, with official setup and documentation links.
- **Educational Video Library:** an introductory data science video and a Kaggle tutorial, with embedded playback and direct viewing links.

### Accounts and learning workspace

The following capabilities are implemented and depend on a configured Supabase backend, verified identity, role permissions, and applicable release gates:

- **Registration and authentication:** email verification, sign-in, recovery/reset flows, and optional persistent sessions. Signup requires both registration and privacy approval; production builds require a fresh owner-readiness check before enabling registration.
- **Student and Team dashboards:** students access released learning content and their own learning records; authorized Team members manage activities, rubrics, grading, and announcements. Leaders and Organizers share the Team authorization role.
- **Profiles and notifications:** private profile viewing/editing, bilingual announcements, learning notifications, and persistent read receipts. Notifications refresh in the app; they are not browser push notifications.
