const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

// Content is written so that each major heading starts a new page — this
// keeps the seeded document's section detection unambiguous, and gives
// the demo project believable evidence for most (not all — on purpose,
// so "missing evidence" has something to show) criteria.
const SECTIONS = [
  { heading: 'Abstract', body: 'This report presents the Smart Campus Security Monitoring System, a computer-vision based platform for detecting unauthorized access on college campuses.' },
  { heading: 'Introduction', body: 'Campus security incidents have increased in recent years. Manual monitoring by security staff is not scalable across large campuses with limited personnel.' },
  { heading: 'Problem Statement', body: 'Existing campus surveillance relies on manual review of camera footage after incidents occur. The problem addressed by this project is the lack of real-time automated detection of unauthorized access for campus security staff and students, within a defined scope of three campus entry points.' },
  { heading: 'Objectives', body: 'The objective of this project is to design a measurable, automated alert system with the following objectives: (1) detect unauthorized entry with at least 90% accuracy, (2) generate an alert within 5 seconds, (3) align with the problem of delayed manual monitoring.' },
  { heading: 'Methodology', body: 'The system methodology follows a three-stage workflow: video capture, object detection using a convolutional neural network, and rule-based alert generation. The architecture uses a modular pipeline design so each stage can be replaced independently.' },
  { heading: 'System Architecture', body: 'The system architecture consists of an edge camera module, a Node.js backend service, and a PostgreSQL database for event storage. Communication between modules occurs over a secured REST API.' },
  { heading: 'Implementation', body: 'The implementation was completed using the technology stack: Python for the detection module, Node.js and Express for the backend API, React for the admin dashboard, and PostgreSQL for storage. The system contains five modules: capture, detection, alerting, storage, and dashboard.' },
  { heading: 'Technologies', body: 'Technology stack used: Python, OpenCV, TensorFlow, Node.js, Express, React, PostgreSQL, Docker.' },
  { heading: 'Testing', body: 'The system was evaluated using 40 test cases covering entry detection, false-alarm suppression, and alert latency. Unit tests covered the detection module in isolation; integration tests covered the full alert pipeline.' },
  { heading: 'Evaluation', body: 'Performance evaluation was conducted against a labelled dataset of 500 campus entry events. The system achieved 94% accuracy and an average response time of 850 ms across all test cases.' },
  { heading: 'Results', body: 'The proposed system achieved 94% accuracy in unauthorized-access detection, compared to 71% accuracy for the previous manual-review baseline. The current implementation supports 100 concurrent users during load testing.' },
  { heading: 'Security', body: 'The backend implements JWT-based authentication and role-based authorization for the admin dashboard. Passwords are stored using bcrypt password hashing. All API endpoints use input validation and rate limiting to reduce brute-force risk. The system supports 500 concurrent users under the planned production configuration.' },
  { heading: 'Limitations', body: 'Known limitations of the current system include reduced detection accuracy in low-light conditions and reliance on a single camera angle per entry point. Assumptions include stable network connectivity between edge devices and the backend.' },
  { heading: 'Future Scope', body: 'Future work includes extending detection to low-light conditions using infrared sensors, and adding multi-camera fusion to address current single-angle limitations.' },
  { heading: 'Conclusion', body: 'The Smart Campus Security Monitoring System demonstrates that automated, real-time detection can meaningfully improve on manual campus monitoring, with measurable gains in accuracy and response time.' },
  { heading: 'References', body: '[1] R. Kumar et al., "Real-time object detection for surveillance," IEEE Conference on Computer Vision, 2022. [2] A. Singh, "Edge-based video analytics," ACM Transactions, 2021. DOI:10.1000/example.' },
];

function generateDemoPdf(outputPath) {
  const doc = new PDFDocument({ margin: 50 });
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  doc.fontSize(20).text('Smart Campus Security Monitoring System', { align: 'center' });
  doc.fontSize(12).text('Demo Academic Project Report — AccrediGuard AI seed data', { align: 'center' });
  doc.moveDown(2);

  SECTIONS.forEach((section, idx) => {
    if (idx > 0) doc.addPage();
    doc.fontSize(16).text(section.heading);
    doc.moveDown(0.5);
    doc.fontSize(11).text(section.body, { align: 'justify' });
  });

  doc.end();

  return new Promise((resolve, reject) => {
    // Wait for 'close' rather than 'finish': 'finish' fires once all data has
    // been handed to the OS write buffer, but the file descriptor may not be
    // closed/flushed yet — reading the file immediately afterward (as the
    // seed script does, piping straight into pdf-parse) can see a truncated
    // file, especially on Windows. 'close' guarantees the fd is released and
    // the bytes are actually visible to other readers.
    stream.on('close', resolve);
    stream.on('error', reject);
  });
}

module.exports = { generateDemoPdf };

if (require.main === module) {
  const out = path.resolve(__dirname, '../../uploads/demo-report.pdf');
  generateDemoPdf(out).then(() => console.log('Demo PDF generated at', out));
}
