const http = require('http');
const fs = require('fs');
const path = require('path');
var forum;

const root = __dirname;
const port = process.env.PORT || 8080;
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
      forum.login(data.username||'', data.password||'', function(result){json(res, result);});
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
  if(url === '/api/latest' && req.method === 'GET'){
    var https = require('https');
    return https.get('https://ultrarumble.com', function(resp){
      var data='';resp.on('data',function(c){data+=c;});resp.on('end',function(){
        var chars=[],gachas=[];
        var parts=data.split('<div class="rel-card');
        for(var i=1;i<parts.length&&i<=6;i++){
          var card=parts[i];var img=card.match(/src="([^"]+)"/);var name=card.match(/"rel-name"[^>]*>([\s\S]*?)<\//);
          if(img)chars.push({img:img[1].replace(/&amp;/g,'&'),name:name?name[1].trim():''});
        }
        var gparts=data.split('<div class="gacha-card');
        for(var gi=1;gi<gparts.length;gi++){
          var gc=gparts[gi];var gimg=gc.match(/src="([^"]+)"/);var gtype=gc.match(/"gacha-type"[^>]*>([\s\S]*?)<\//);var gname=gc.match(/"gacha-name"[^>]*>([\s\S]*?)<\//);
          if(gimg)gachas.push({img:gimg[1],type:gtype?gtype[1].trim():'',name:gname?gname[1].trim():''});
        }
        json(res,{chars:chars,gachas:gachas});
      });
    }).on('error',function(e){json(res,{chars:[],gachas:[]});});
  }
  if(url === '/api/admin/demote' && req.method === 'POST'){
    return body(req, function(data){
      forum.demoteUser((data.caller||'').toLowerCase().trim(), (data.username||'').trim(), function(result){json(res, result);});
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
