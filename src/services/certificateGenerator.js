const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { Member, Course, Event } = require('../models');

const CERTIFICATE_DIR = path.join(__dirname, '../../uploads/certificates');

// Ensure certificate directory exists
if (!fs.existsSync(CERTIFICATE_DIR)) {
  fs.mkdirSync(CERTIFICATE_DIR, { recursive: true });
}

/**
 * Generate Course Completion Certificate
 */
const generateCourseCertificate = async (memberId, courseId, enrollmentId) => {
  try {
    const member = await Member.findByPk(memberId, {
      include: [{ model: User, as: 'user' }]
    });
    const course = await Course.findByPk(courseId);

    if (!member || !course) {
      throw new Error('Member or Course not found');
    }

    const fileName = `course-certificate-${member.sin || memberId}-${courseId}-${Date.now()}.pdf`;
    const filePath = path.join(CERTIFICATE_DIR, fileName);

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 50
    });

    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    // Certificate design
    doc.rect(40, 40, doc.page.width - 80, doc.page.height - 80)
       .stroke('#D4A017', 3);

    doc.rect(50, 50, doc.page.width - 100, doc.page.height - 100)
       .stroke('#002B5C', 1);

    // Title
    doc.fontSize(32)
       .fillColor('#002B5C')
       .font('Helvetica-Bold')
       .text('CERTIFICATE OF COMPLETION', 0, 120, {
         align: 'center',
         width: doc.page.width - 100
       });

    doc.fontSize(14)
       .fillColor('#4A4A4A')
       .font('Helvetica')
       .text('This certificate is awarded to', 0, 180, {
         align: 'center',
         width: doc.page.width - 100
       });

    // Member name
    doc.fontSize(28)
       .fillColor('#D4A017')
       .font('Helvetica-Bold')
       .text(member.first_name + ' ' + member.last_name, 0, 210, {
         align: 'center',
         width: doc.page.width - 100
       });

    doc.fontSize(14)
       .fillColor('#4A4A4A')
       .font('Helvetica')
       .text('for successfully completing the course', 0, 270, {
         align: 'center',
         width: doc.page.width - 100
       });

    doc.fontSize(22)
       .fillColor('#002B5C')
       .font('Helvetica-Bold')
       .text(course.title, 0, 300, {
         align: 'center',
         width: doc.page.width - 100
       });

    // Date
    doc.fontSize(12)
       .fillColor('#4A4A4A')
       .font('Helvetica')
       .text(`Date: ${new Date().toLocaleDateString()}`, 0, 370, {
         align: 'center',
         width: doc.page.width - 100
       });

    // Signatures
    const signatureY = 420;
    doc.fontSize(12)
       .fillColor('#4A4A4A')
       .font('Helvetica')
       .text('National Commissioner', 150, signatureY, {
         width: 200,
         align: 'center'
       });
    doc.moveTo(150, signatureY + 10)
       .lineTo(350, signatureY + 10)
       .stroke();

    doc.text('Course Instructor', doc.page.width - 350, signatureY, {
      width: 200,
      align: 'center'
    });
    doc.moveTo(doc.page.width - 350, signatureY + 10)
       .lineTo(doc.page.width - 150, signatureY + 10)
       .stroke();

    // Footer
    doc.fontSize(10)
       .fillColor('#7A7A7A')
       .font('Helvetica')
       .text('This certificate is issued by MyScout Rwanda (MSR)', 0, doc.page.height - 80, {
         align: 'center',
         width: doc.page.width - 100
       });

    doc.text(`Certificate ID: ${enrollmentId || 'N/A'}`, 0, doc.page.height - 60, {
      align: 'center',
      width: doc.page.width - 100
    });

    doc.end();

    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => {
        resolve({
          success: true,
          filePath,
          fileName,
          url: `/uploads/certificates/${fileName}`
        });
      });
      writeStream.on('error', reject);
    });

  } catch (error) {
    console.error('Certificate generation error:', error);
    throw error;
  }
};

/**
 * Generate Event Participation Certificate
 */
const generateEventCertificate = async (memberId, eventId, registrationId) => {
  try {
    const member = await Member.findByPk(memberId, {
      include: [{ model: User, as: 'user' }]
    });
    const event = await Event.findByPk(eventId);

    if (!member || !event) {
      throw new Error('Member or Event not found');
    }

    const fileName = `event-certificate-${member.sin || memberId}-${eventId}-${Date.now()}.pdf`;
    const filePath = path.join(CERTIFICATE_DIR, fileName);

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 50
    });

    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    // Certificate design
    doc.rect(40, 40, doc.page.width - 80, doc.page.height - 80)
       .stroke('#D4A017', 3);

    doc.rect(50, 50, doc.page.width - 100, doc.page.height - 100)
       .stroke('#002B5C', 1);

    // Title
    doc.fontSize(32)
       .fillColor('#002B5C')
       .font('Helvetica-Bold')
       .text('CERTIFICATE OF PARTICIPATION', 0, 120, {
         align: 'center',
         width: doc.page.width - 100
       });

    doc.fontSize(14)
       .fillColor('#4A4A4A')
       .font('Helvetica')
       .text('This certificate is proudly presented to', 0, 180, {
         align: 'center',
         width: doc.page.width - 100
       });

    // Member name
    doc.fontSize(28)
       .fillColor('#D4A017')
       .font('Helvetica-Bold')
       .text(member.first_name + ' ' + member.last_name, 0, 210, {
         align: 'center',
         width: doc.page.width - 100
       });

    doc.fontSize(14)
       .fillColor('#4A4A4A')
       .font('Helvetica')
       .text('for their participation in', 0, 270, {
         align: 'center',
         width: doc.page.width - 100
       });

    doc.fontSize(22)
       .fillColor('#002B5C')
       .font('Helvetica-Bold')
       .text(event.title, 0, 300, {
         align: 'center',
         width: doc.page.width - 100
       });

    // Event date
    const eventDate = event.start_date ? new Date(event.start_date).toLocaleDateString() : 'N/A';
    doc.fontSize(12)
       .fillColor('#4A4A4A')
       .font('Helvetica')
       .text(`Event Date: ${eventDate}`, 0, 350, {
         align: 'center',
         width: doc.page.width - 100
       });

    // Signatures
    const signatureY = 400;
    doc.fontSize(12)
       .fillColor('#4A4A4A')
       .font('Helvetica')
       .text('National Commissioner', 150, signatureY, {
         width: 200,
         align: 'center'
       });
    doc.moveTo(150, signatureY + 10)
       .lineTo(350, signatureY + 10)
       .stroke();

    doc.text('Event Organizer', doc.page.width - 350, signatureY, {
      width: 200,
      align: 'center'
    });
    doc.moveTo(doc.page.width - 350, signatureY + 10)
       .lineTo(doc.page.width - 150, signatureY + 10)
       .stroke();

    // Footer
    doc.fontSize(10)
       .fillColor('#7A7A7A')
       .font('Helvetica')
       .text('MyScout Rwanda (MSR) - Empowering Youth for Change', 0, doc.page.height - 80, {
         align: 'center',
         width: doc.page.width - 100
       });

    doc.text(`Certificate ID: ${registrationId || 'N/A'}`, 0, doc.page.height - 60, {
      align: 'center',
      width: doc.page.width - 100
    });

    doc.end();

    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => {
        resolve({
          success: true,
          filePath,
          fileName,
          url: `/uploads/certificates/${fileName}`
        });
      });
      writeStream.on('error', reject);
    });

  } catch (error) {
    console.error('Certificate generation error:', error);
    throw error;
  }
};

module.exports = {
  generateCourseCertificate,
  generateEventCertificate
};