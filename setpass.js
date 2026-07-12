var fs = require('fs');
var c = require('crypto');
var initSqlJs = require('sql.js');
var pw = c.createHash('sha256').update('Dumo_625').digest('hex');

console.log('Hash:', pw);

initSqlJs().then(function(SQL){
  var db = new SQL.Database(fs.readFileSync('forum.db'));
  
  // Check current users
  var r1 = db.exec("SELECT username, password FROM forum_users");
  if(r1.length) {
    console.log('Current users:');
    r1[0].values.forEach(function(v){console.log('  '+v[0]+': hasPassword='+!!v[1]);});
  }
  
  // Set password for shockedrex
  db.run("UPDATE forum_users SET password='" + pw + "' WHERE username='shockedrex'");
  
  // Verify
  var r2 = db.exec("SELECT username, password FROM forum_users WHERE username='shockedrex'");
  if(r2.length) console.log('Updated:', r2[0].values[0][0], 'hasPassword:', !!r2[0].values[0][1]);
  else console.log('User not found');
  
  fs.writeFileSync('forum.db', Buffer.from(db.export()));
  console.log('Done');
});
