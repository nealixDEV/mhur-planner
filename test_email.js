var nodemailer = require('nodemailer');
var t = nodemailer.createTransport({
  service: 'gmail',
  auth: {user: 'andre.abil911@gmail.com', pass: 'twou zydh lygn qaex'}
});
t.sendMail({
  from: 'andre.abil911@gmail.com',
  to: 'andre.abil911@gmail.com',
  subject: 'Test from EC2',
  text: 'If you see this, email works!'
}, function(e, i) {
  if(e) console.log('Error:', e.message);
  else console.log('Sent:', i.messageId);
});
