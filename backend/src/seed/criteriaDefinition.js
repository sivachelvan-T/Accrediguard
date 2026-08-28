// "Demo Academic Quality Framework" — explicitly NOT an official NBA/NAAC
// framework. Administrators can define official criteria sets separately;
// this is seeded so the app is demonstrable out of the box.
const CRITERIA = [
  {
    code: 'C1', title: 'Problem Definition',
    keywords: ['problem statement', 'problem definition', 'users', 'scope', 'issue', 'challenge'],
    requiredSections: ['Problem Statement', 'Introduction'],
    evidenceExpectations: ['clear problem statement', 'identified users', 'identified problem', 'measurable scope'],
  },
  {
    code: 'C2', title: 'Objectives',
    keywords: ['objective', 'objectives', 'goal', 'aim', 'measurable'],
    requiredSections: ['Objectives'],
    evidenceExpectations: ['clear objectives', 'measurable objectives', 'alignment with problem'],
  },
  {
    code: 'C3', title: 'Methodology',
    keywords: ['methodology', 'workflow', 'architecture', 'approach', 'design'],
    requiredSections: ['Methodology', 'System Architecture'],
    evidenceExpectations: ['methodology', 'workflow', 'architecture', 'implementation approach'],
  },
  {
    code: 'C4', title: 'Technical Implementation',
    keywords: ['technology stack', 'implementation', 'module', 'framework', 'database', 'api'],
    requiredSections: ['Implementation', 'Technologies'],
    evidenceExpectations: ['technology stack', 'implementation details', 'system modules'],
  },
  {
    code: 'C5', title: 'Testing and Validation',
    keywords: ['test case', 'testing', 'validation', 'accuracy', 'precision', 'recall', 'performance', 'latency', 'response time', 'unit test', 'integration test'],
    requiredSections: ['Testing', 'Evaluation', 'Results'],
    evidenceExpectations: ['test cases', 'test results', 'validation metrics', 'performance measures'],
  },
  {
    code: 'C6', title: 'Security',
    keywords: ['authentication', 'authorization', 'jwt', 'rbac', 'encryption', 'https', 'password hashing', 'bcrypt', 'validation', 'input sanitization', 'rate limiting', 'audit log', 'security headers'],
    requiredSections: ['Security'],
    evidenceExpectations: ['authentication', 'authorization', 'input validation', 'secure data handling', 'threat considerations'],
  },
  {
    code: 'C7', title: 'Results',
    keywords: ['results', 'accuracy', 'comparison', 'metrics', 'figure', 'table'],
    requiredSections: ['Results'],
    evidenceExpectations: ['measurable results', 'comparison', 'metrics'],
  },
  {
    code: 'C8', title: 'Limitations',
    keywords: ['limitation', 'assumption', 'constraint'],
    requiredSections: ['Limitations'],
    evidenceExpectations: ['known limitations', 'assumptions', 'constraints'],
  },
  {
    code: 'C9', title: 'Future Enhancement',
    keywords: ['future scope', 'future work', 'enhancement', 'roadmap'],
    requiredSections: ['Future Scope'],
    evidenceExpectations: ['realistic future scope', 'limitations addressed'],
  },
  {
    code: 'C10', title: 'References',
    keywords: ['references', 'bibliography', 'doi', 'ieee', 'et al'],
    requiredSections: ['References'],
    evidenceExpectations: ['citations', 'bibliography', 'credible references'],
  },
];

module.exports = { CRITERIA };
