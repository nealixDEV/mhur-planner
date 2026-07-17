const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
var forum;

const root = __dirname;
const port = process.env.PORT || 8080;

// Email config
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';
var transporter = null;
try {
  if(EMAIL_USER && EMAIL_PASS){
    var nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      service:'gmail',
      auth:{user:EMAIL_USER, pass:EMAIL_PASS}
    });
    console.log('Email configured for',EMAIL_USER);
  }
} catch(e){console.log('Email not available:',e.message);}

function sendEmail(to, subject, html){
  if(!transporter){console.log('Email not configured, skipping');return;}
  transporter.sendMail({from:EMAIL_USER, to:to, subject:subject, html:html}, function(err, info){
    if(err)console.log('Send email error:',err.message);
    else console.log('Email sent to',to);
  });
}

const CHARS={izuku:"Izuku Midoriya",izuku_ofa:"Izuku Midoriya (OFA)",katsuki:"Katsuki Bakugo",ochaco:"Ochaco Uraraka",tenya:"Tenya Iida",tsuyu:"Tsuyu Asui",shoto:"Shoto Todoroki",eijiro:"Eijiro Kirishima",momo:"Momo Yaoyorozu",fumikage:"Fumikage Tokoyami",denki:"Denki Kaminari",neito:"Neito Monoma",kendo:"Itsuka Kendo",ibara:"Ibara Shiozaki",mirio:"Mirio Togata",tamaki:"Tamaki Amajiki",nejire:"Nejire Hado",hitoshi:"Hitoshi Shinso",allmight:"All Might",armored:"Armored All Might",aizawa:"Shota Aizawa",mic:"Present Mic",cement:"Cementoss",endeavor:"Endeavor",hawks:"Hawks",mirko:"Mirko",star:"Star and Stripe",mtlady:"Mt. Lady",tomura:"Tomura Shigaraki",afo:"All For One",afo_youth:"All For One (Youth)",dabi:"Dabi",himiko:"Himiko Toga",twice:"Twice",compress:"Mr. Compress",kurogiri:"Kurogiri",nagant:"Lady Nagant",overhaul:"Overhaul"};
const types = {
  '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
  '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.gif':'image/gif', '.webp':'image/webp', '.svg':'image/svg+xml',
  '.mp4':'video/mp4', '.webm':'video/webm', '.ogg':'video/ogg'
};

function json(res, data, status){
  res.writeHead(status||200, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
  res.end(JSON.stringify(data));
}
function body(req, cb){
  var parts=[];
  req.on('data',function(d){parts.push(d);});
  req.on('end',function(){
    try{cb(JSON.parse(Buffer.concat(parts).toString()));}
    catch(e){cb({});}
  });
}

function handler(req, res) {
  if(!forum){res.writeHead(503);res.end('Initializing...');return;}
  var url = req.url.split('?')[0];
  var query = {};
  (req.url.split('?')[1]||'').split('&').forEach(function(p){
    var kv=p.split('=');if(kv[0])query[decodeURIComponent(kv[0])]=decodeURIComponent(kv[1]||'');
  });

  // API routes - all async via callbacks
  if(url === '/api/posts' && req.method === 'GET'){
    return forum.list(parseInt(query.page)||1, query.sort||'hot', function(data){json(res, data);});
  }
  if(url === '/api/posts' && req.method === 'POST'){
    return body(req, function(data){
      forum.create(data, function(result){
        if(result.error) return json(res, result, 400);
        json(res, result, 201);
      });
    });
  }
  if(url === '/api/posts/search' && req.method === 'GET'){
    return forum.search(query.q||'', function(data){json(res, data);});
  }
  if(url === '/api/posts/by-author' && req.method === 'GET'){
    return forum.listByAuthor(query.author||'', parseInt(query.page)||1, function(data){json(res, data);});
  }
  if(url.match(/^\/api\/posts\/([a-z0-9]+)$/) && req.method === 'GET'){
    var id = url.match(/^\/api\/posts\/([a-z0-9]+)$/)[1];
    return forum.get(id, function(post){
      if(!post) return json(res, {error:'Not found'}, 404);
      json(res, post);
    });
  }
  if(url === '/api/news'){
    json(res, {season:'17',seasonEnd:'2026-07-29 12:59:59',patches:[]});
    return;
  }
  if(url.match(/^\/api\/posts\/([a-z0-9]+)\/like$/) && req.method === 'POST'){
    var id = url.match(/^\/api\/posts\/([a-z0-9]+)\/like$/)[1];
    return forum.like(id, function(data){json(res, data);});
  }
  if(url.match(/^\/api\/posts\/([a-z0-9]+)\/unlike$/) && req.method === 'POST'){
    var id = url.match(/^\/api\/posts\/([a-z0-9]+)\/unlike$/)[1];
    return forum.unlike(id, function(data){json(res, data);});
  }
  if(url.match(/^\/api\/posts\/([a-z0-9]+)\/comment$/) && req.method === 'POST'){
    var id = url.match(/^\/api\/posts\/([a-z0-9]+)\/comment$/)[1];
    return body(req, function(data){
      forum.comment(id, data, function(result){json(res, result);});
    });
  }
  if(url.match(/^\/api\/posts\/([a-z0-9]+)$/) && req.method === 'DELETE'){
    var id = url.match(/^\/api\/posts\/([a-z0-9]+)$/)[1];
    return body(req, function(data){
      forum.deletePost(id, data.deleteKey||'', function(result){json(res, result);});
    });
  }
  if(url.match(/^\/api\/posts\/([a-z0-9]+)\/comment\/([a-z0-9]+)$/) && req.method === 'DELETE'){
    var m = url.match(/^\/api\/posts\/([a-z0-9]+)\/comment\/([a-z0-9]+)$/);
    return body(req, function(data){
      forum.deleteComment(m[1], m[2], data.deleteKey||'', data.isReply||false, function(result){json(res, result);});
    });
  }
  if(url.match(/^\/api\/posts\/([a-z0-9]+)$/) && req.method === 'PUT'){
    var id = url.match(/^\/api\/posts\/([a-z0-9]+)$/)[1];
    return body(req, function(data){
      forum.editPost(id, data, data.deleteKey||'', function(result){json(res, result);});
    });
  }
  if(url.match(/^\/api\/posts\/([a-z0-9]+)\/pin$/) && req.method === 'POST'){
    var id = url.match(/^\/api\/posts\/([a-z0-9]+)\/pin$/)[1];
    return body(req, function(data){
      forum.togglePin(id, data.deleteKey||'', function(result){json(res, result);});
    });
  }
  if(url.match(/^\/api\/posts\/([a-z0-9]+)\/comment\/([a-z0-9]+)$/) && req.method === 'PUT'){
    var m = url.match(/^\/api\/posts\/([a-z0-9]+)\/comment\/([a-z0-9]+)$/);
    return body(req, function(data){
      forum.editComment(m[1], m[2], data, data.deleteKey||'', data.isReply||false, function(result){json(res, result);});
    });
  }
  if(url.match(/^\/api\/uploads\/([a-z0-9]+)\.\w+$/) && req.method === 'GET'){
    var uploadId = url.match(/^\/api\/uploads\/([a-z0-9]+)\.\w+$/)[1];
    return forum.getUpload(uploadId, function(file){
      if(!file){res.writeHead(404);res.end('Not found');return;}
      res.writeHead(200,{'Content-Type':file.mime,'Cache-Control':'no-store'});
      res.end(Buffer.from(file.data,'base64'));
    });
  }
  if(url === '/api/upload' && req.method === 'POST'){
    return body(req, function(data){
      var imgData = data.image || '';
      var matches = imgData.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/) || imgData.match(/^data:video\/(mp4|webm|ogg);base64,(.+)$/);
      if(!matches) return json(res, {error:'Invalid image'}, 400);
      var ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
      var mime = matches[0].startsWith('data:image/') ? 'image/'+ext : 'video/'+ext;
      var uploadId = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
      forum.saveUpload(uploadId, matches[2], mime, function(ok){
        if(ok===false) return json(res, {error:'Database save failed'}, 500);
        json(res, {url:'/api/uploads/'+uploadId+'.'+ext});
      });
    });
  }
  if(url === '/api/register-user' && req.method === 'POST'){
    return body(req, function(data){
      forum.registerUser(data, function(result){json(res, result);});
    });
  }
  if(url === '/api/login' && req.method === 'POST'){
    return body(req, function(data){
      forum.login(data.username||'', data.password||'', function(result){
        // Send login notification email if user has email set
        if(result && result.success && result.email){
          var loginTime = new Date().toLocaleString('en-US',{timeZone:'UTC'});
          var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
          sendEmail(result.email, 'MHUR Planner - New Login',
            '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:20px;background:#1e1e2e;color:#e2e8f0;border-radius:12px;border:1px solid rgba(245,200,0,.2);">'+
            '<h2 style="color:#f5c800;margin:0 0 12px;">&#128274; New Login Detected</h2>'+
            '<p style="color:#94a3b8;font-size:.9rem;">Your account <strong style="color:#f5c800;">'+result.username+'</strong> was just logged in to.</p>'+
            '<div style="background:rgba(0,0,0,.3);border-radius:8px;padding:12px;margin:12px 0;">'+
            '<p style="margin:0 0 4px;color:#64748b;font-size:.8rem;">Time: <span style="color:#e2e8f0;">'+loginTime+' UTC</span></p>'+
            '<p style="margin:0;color:#64748b;font-size:.8rem;">IP: <span style="color:#e2e8f0;">'+ip+'</span></p>'+
            '</div>'+
            '<p style="color:#64748b;font-size:.75rem;">If this wasn\'t you, someone may have your password. You can reset it at <a href="https://mhur-planner.duckdns.org" style="color:#f5c800;">MHUR Planner</a>.</p>'+
            '</div>'
          );
        }
        json(res, result);
      });
    });
  }
  if(url === '/api/forgot-password' && req.method === 'POST'){
    return body(req, function(data){
      var email = (data.email||'').trim().toLowerCase();
      if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
        json(res, {error:'Valid email required'}, 400);return;
      }
      var token = crypto.randomBytes(32).toString('hex');
      forum.forgotPassword(email, token, function(result){
        if(result && result.sent && result.username){
          var resetLink = 'https://mhur-planner.duckdns.org/?reset='+token;
          sendEmail(email, 'MHUR Planner - Password Reset',
            '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:20px;background:#1e1e2e;color:#e2e8f0;border-radius:12px;border:1px solid rgba(245,200,0,.2);">'+
            '<h2 style="color:#f5c800;margin:0 0 12px;">&#128273; Password Reset Request</h2>'+
            '<p style="color:#94a3b8;font-size:.9rem;">Hi <strong style="color:#f5c800;">'+result.username+'</strong>,</p>'+
            '<p style="color:#94a3b8;font-size:.85rem;margin:8px 0;">Click the button below to reset your password. This link expires in 1 hour.</p>'+
            '<a href="'+resetLink+'" style="display:inline-block;background:linear-gradient(135deg,#f5c800,#f59e0b);color:#000;font-weight:900;padding:10px 24px;border-radius:8px;text-decoration:none;margin:12px 0;">Reset Password</a>'+
            '<p style="color:#64748b;font-size:.7rem;">If you didn\'t request this, ignore this email.</p>'+
            '</div>'
          );
          json(res, {sent:true});
        }else{
          // Always return sent:true to prevent email enumeration
          json(res, {sent:true});
        }
      });
    });
  }
  if(url === '/api/reset-password' && req.method === 'POST'){
    return body(req, function(data){
      forum.resetPassword(data.token||'', data.newPassword||'', function(result){
        json(res, result);
      });
    });
  }
  if(url === '/api/set-email' && req.method === 'POST'){
    return body(req, function(data){
      forum.setUserEmail(data.username||'', data.email||'', function(result){json(res, result);});
    });
  }
  if(url === '/api/get-email' && req.method === 'GET'){
    return forum.getUserEmail(query.username||'', function(email){
      json(res, {email:email||''});
    });
  }
  if(url === '/api/change-password' && req.method === 'POST'){
    return body(req, function(data){
      forum.changePassword(data.username||'', data.oldPassword||'', data.newPassword||'', function(result){json(res, result);});
    });
  }
  if(url === '/api/set-avatar' && req.method === 'POST'){
    return body(req, function(data){
      forum.setUserAvatar(data.username||'', data.avatar||'', function(){json(res, {saved:true});});
    });
  }
  if(url === '/api/set-banner' && req.method === 'POST'){
    return body(req, function(data){
      forum.setUserBanner(data.username||'', data.banner||'', function(){json(res, {saved:true});});
    });
  }
  if(url === '/api/set-banner-desc' && req.method === 'POST'){
    return body(req, function(data){
      forum.setUserBannerDesc(data.username||'', data.desc||'', function(){json(res, {saved:true});});
    });
  }
  if(url === '/api/set-links' && req.method === 'POST'){
    return body(req, function(data){
      forum.setUserLinks(data.username||'', JSON.stringify(data.links||[]), function(){json(res, {saved:true});});
    });
  }
  if(url === '/api/check-user' && req.method === 'GET'){
    return forum.getUser(query.name||'', function(user){json(res, user||{exists:false});});
  }
  if(url === '/api/user-titles' && req.method === 'GET'){
    var uname=(query.name||'').toLowerCase().trim();
    return forum.getUserTitles(uname, function(result){json(res, result);});
  }
  if(url === '/api/set-title' && req.method === 'POST'){
    return body(req, function(data){
      var uname=(data.username||'').toLowerCase().trim();
      var title=(data.title||'').trim();
      var color=(data.title_color||'').trim();
      forum.setUserTitle(uname, title, function(){
        forum.setUserTitleColor(uname, color, function(){
          json(res,{ok:true});
        });
      });
    });
  }
  if(url === '/api/users' && req.method === 'GET'){
    return forum.listUsers(function(users){json(res, {users:users});});
  }
  if(url === '/api/verify-key' && req.method === 'POST'){
    return body(req, function(data){
      var key=data.deleteKey||'';
      var username=(data.username||'').toLowerCase().trim();
      var isOwnerKey=key.indexOf('mhur_owner_')===0;
      forum.isKeyUsed(key,function(used){
        if(used){json(res,{valid:false,error:'Invalid or already used key'});return;}
        forum.markKeyUsed(key,function(){
          if(username){
            forum.setUserAdmin(username, isOwnerKey?2:1, function(){});
            json(res,{valid:true,username:username,owner:isOwnerKey});
          }else{
            json(res,{valid:true,username:username});
          }
        });
      });
    });
  }
  if(url === '/api/admin/generate-keys' && req.method === 'POST'){
    return body(req, function(data){
      forum.generateAdminKeys(parseInt(data.count)||1, function(keys){json(res,{keys:keys});});
    });
  }
  if(url === '/api/admin/generate-owner-keys' && req.method === 'POST'){
    return body(req, function(data){
      forum.generateAdminKeys(parseInt(data.count)||1, 'mhur_owner_', function(keys){json(res,{keys:keys});});
    });
  }
  if(url === '/api/admin/list-keys' && req.method === 'GET'){
    return forum.listAdminKeys(function(keys){json(res,{keys:keys});});
  }
  if(url === '/api/admin/list-admins' && req.method === 'GET'){
    return forum.listAdmins(function(admins){console.log('listAdmins result:',admins);json(res,{admins:admins});});
  }
  if(url === '/api/admin/demote' && req.method === 'POST'){
    return body(req, function(data){
      forum.demoteUser((data.caller||'').toLowerCase().trim(), (data.username||'').trim(), function(result){json(res, result);});
    });
  }
  if(url === '/api/admin/ban' && req.method === 'POST'){
    return body(req, function(data){
      forum.banUser((data.caller||'').toLowerCase().trim(), (data.username||'').trim(), data.reason||'', function(result){json(res, result);});
    });
  }
  if(url === '/api/admin/unban' && req.method === 'POST'){
    return body(req, function(data){
      forum.unbanUser((data.caller||'').toLowerCase().trim(), (data.username||'').trim(), function(result){json(res, result);});
    });
  }
  if(url === '/api/admin/mute' && req.method === 'POST'){
    return body(req, function(data){
      forum.muteUser((data.caller||'').toLowerCase().trim(), (data.username||'').trim(), parseInt(data.duration)||60000, function(result){json(res, result);});
    });
  }
  if(url === '/api/admin/unmute' && req.method === 'POST'){
    return body(req, function(data){
      forum.unmuteUser((data.caller||'').toLowerCase().trim(), (data.username||'').trim(), function(result){json(res, result);});
    });
  }
  if(url === '/api/admin/warn' && req.method === 'POST'){
    return body(req, function(data){
      forum.warnUser((data.caller||'').toLowerCase().trim(), (data.username||'').trim(), data.reason||'', function(result){json(res, result);});
    });
  }

  // Backward-compatible: serve old /uploads/* from database
  if(url.match(/^\/uploads\/([a-z0-9]+)\.\w+$/) && req.method === 'GET'){
    var oid = url.match(/^\/uploads\/([a-z0-9]+)\.\w+$/)[1];
    return forum.getUpload(oid, function(file){
      if(!file){res.writeHead(404);res.end('Not found');return;}
      res.writeHead(200,{'Content-Type':file.mime,'Cache-Control':'no-store'});
      res.end(Buffer.from(file.data,'base64'));
    });
  }

  // Build preview / OG tags
  if((url === '/' && query.build) || (url.startsWith('/build/'))){
    var buildCode = query.build || url.replace('/build/','').split('?')[0];
    try {
      var p = JSON.parse(decodeURIComponent(escape(Buffer.from(buildCode,'base64').toString())));
      var cid = p.charId || '';
      var cname = CHARS[cid] || 'Unknown';
      var label = p.label || '';
      var ogTitle = label ? cname+' - '+label : cname+' Build';
      var ogDesc = 'MHUR T.U.N.I.N.G. Build for '+cname+(p.left&&p.left.length?' | '+(p.left.filter(function(s){return s.t;}).length||0)+' tunings':'');
      fs.readFile(path.join(root,'index.html'),'utf8',function(err,html){
        if(err){res.writeHead(500);res.end('Error');return;}
        var ogHtml='<meta property="og:title" content="'+ogTitle+'">\n<meta property="og:description" content="'+ogDesc+'">\n<meta property="og:type" content="website">\n<meta name="twitter:card" content="summary">\n<meta property="og:url" content="http://'+req.headers.host+'/?build='+encodeURIComponent(buildCode)+'">';
        html=html.replace('</title>','</title>\n'+ogHtml);
        html=html.replace('</head>','<script>document.addEventListener("DOMContentLoaded",function(){setTimeout(function(){var inp=document.getElementById("ioCode");if(inp){inp.value=decodeURIComponent("'+encodeURIComponent(buildCode)+'");document.getElementById("btnImp").click();}},200);});</script>\n</head>');
        res.writeHead(200,{'Content-Type':'text/html'});
        res.end(html);
      });
      return;
    } catch(e) {
      console.log('Build preview error:',e.message);
    }
  }

  // Static files
  let urlPath = decodeURIComponent(url);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(root, path.normalize(urlPath));
  if (!filePath.startsWith(root)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
    res.end(data);
  });
}
function start(){
  try{fs.mkdirSync(path.join(root,'uploads'),{recursive:true});}catch(e){}
  // Auto-generate an owner key if no admin keys exist
  forum.listAdminKeys(function(keys){
    if(!keys||!keys.length){
      forum.generateAdminKeys(1, 'mhur_owner_', function(ownerKeys){
        console.log('🚀 First-time setup: Owner key generated — ' + (ownerKeys&&ownerKeys[0]||''));
      });
    }
  });
  http.createServer(handler).listen(port, () => console.log('Serving ' + root + ' at http://0.0.0.0:' + port + '/'));
}

require('./forum_db').then(function(f){forum=f;start();});
