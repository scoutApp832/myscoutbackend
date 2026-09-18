const { Member } = require('../models');

exports.generateSIN = async (memberId) => {
  const prefix = process.env.SIN_PREFIX || 'MSR';
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  
  let sin = `${prefix}${timestamp}${random}`;
  
  let existing = await Member.findOne({ where: { sin } });
  while (existing) {
    const newRandom = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    sin = `${prefix}${timestamp}${newRandom}`;
    existing = await Member.findOne({ where: { sin } });
  }
  
  return sin;
};