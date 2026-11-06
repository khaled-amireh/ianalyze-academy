export type ToolId = 'google-colab' | 'python' | 'vscode' | 'kaggle' | 'power-bi';
export type LearningTool = {
  id: ToolId;
  name: string;
  href: string;
  category: 'course' | 'local' | 'practice' | 'visualization';
  mode: 'online' | 'install';
  platform: 'browser' | 'desktop' | 'windows';
  steps: readonly string[];
  documentation: readonly { label: 'officialDocs' | 'windows' | 'macos' | 'linux'; href: string }[];
  sample?: string;
};

/** Official destinations only. All explanatory copy uses the existing i18next catalogues. */
export const learningTools: readonly LearningTool[] = [
  {
    id: 'google-colab',
    name: 'Google Colab',
    href: 'https://colab.research.google.com/',
    category: 'course',
    mode: 'online',
    platform: 'browser',
    steps: ['open', 'account', 'notebook', 'run'],
    documentation: [
      { label: 'officialDocs', href: 'https://research.google.com/colaboratory/faq.html' },
    ],
    sample: 'print("Hello, iAnalyze!")',
  },
  {
    id: 'python',
    name: 'Python',
    href: 'https://www.python.org/downloads/',
    category: 'local',
    mode: 'install',
    platform: 'desktop',
    steps: ['download', 'windows', 'macos', 'linux'],
    documentation: [
      { label: 'windows', href: 'https://docs.python.org/3/using/windows.html' },
      { label: 'macos', href: 'https://docs.python.org/3/using/mac.html' },
      { label: 'linux', href: 'https://docs.python.org/3/using/unix.html' },
    ],
    sample: '# Windows\npy --version\n\n# macOS / Linux\npython3 --version',
  },
  {
    id: 'vscode',
    name: 'Visual Studio Code',
    href: 'https://code.visualstudio.com/download',
    category: 'local',
    mode: 'install',
    platform: 'desktop',
    steps: ['windows', 'macos', 'linux', 'extension', 'interpreter', 'run'],
    documentation: [
      { label: 'officialDocs', href: 'https://code.visualstudio.com/docs/python/python-tutorial' },
    ],
    sample: 'print("Hello, iAnalyze!")',
  },
  {
    id: 'kaggle',
    name: 'Kaggle',
    href: 'https://www.kaggle.com/',
    category: 'practice',
    mode: 'online',
    platform: 'browser',
    steps: ['open', 'account', 'dataset', 'notebook'],
    documentation: [{ label: 'officialDocs', href: 'https://www.kaggle.com/docs/notebooks' }],
  },
  {
    id: 'power-bi',
    name: 'Power BI Desktop',
    href: 'https://www.microsoft.com/en-us/power-platform/products/power-bi/desktop',
    category: 'visualization',
    mode: 'install',
    platform: 'windows',
    steps: ['download', 'install', 'open', 'import'],
    documentation: [
      {
        label: 'officialDocs',
        href: 'https://learn.microsoft.com/en-us/power-bi/fundamentals/desktop-get-the-desktop',
      },
    ],
  },
];

export const findLearningTool = (id: string | undefined) =>
  learningTools.find((tool) => tool.id === id);
