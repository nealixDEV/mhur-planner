const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const forum = require('./forum_db');

const root = __dirname;
const port = process.env.PORT || 8080;
const types = {
  '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
  '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml'
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

http.createServer((req, res) => {
  var url = req.url.split('?')[0];
  var query = {};
  (req.url.split('?')[1]||'').split('&').forEach(function(p){
    var kv=p.split('=');if(kv[0])query[decodeURIComponent(kv[0])]=decodeURIComponent(kv[1]||'');
  });

  // API routes
  if(url === '/api/posts' && req.method === 'GET'){
    return json(res, forum.list(parseInt(query.page)||1, query.sort||'hot'));
  }
  if(url === '/api/posts' && req.method === 'POST'){
    return body(req, function(data){
      var result = forum.create(data);
      if(result.error) return json(res, result, 400);
      json(res, result, 201);
    });
  }
  if(url.match(/^\/api\/posts\/([a-z0-9]+)$/) && req.method === 'GET'){
    var id = url.match(/^\/api\/posts\/([a-z0-9]+)$/)[1];
    var post = forum.get(id);
    if(!post) return json(res, {error:'Not found'}, 404);
    return json(res, post);
  }
  if(url.match(/^\/api\/posts\/([a-z0-9]+)\/like$/) && req.method === 'POST'){
    var id = url.match(/^\/api\/posts\/([a-z0-9]+)\/like$/)[1];
    return json(res, forum.like(id));
  }
  if(url.match(/^\/api\/posts\/([a-z0-9]+)\/comment$/) && req.method === 'POST'){
    var id = url.match(/^\/api\/posts\/([a-z0-9]+)\/comment$/)[1];
    return body(req, function(data){
      json(res, forum.comment(id, data));
    });
  }
  if(url === '/api/posts/search' && req.method === 'GET'){
    return json(res, forum.search(query.q||''));
  }
  if(url === '/api/news'){
    https.get('https://ultrarumble.com/', function(r){
      var d='';r.on('data',function(c){d+=c;});r.on('end',function(){
        var season=d.match(/Season (\d+)/);
        var endMatch=d.match(/End:\s*([\d\-:\s]+)/);
        var patches=[],idx=d.indexOf('Recent Patch Notes');
        if(idx>0){
          var section=d.slice(idx,idx+3000);
          var re=/<h3>([\s\S]*?)<\/h3>/g,m;
          while((m=re.exec(section))!==null) patches.push(m[1].replace(/<[^>]*>/g,'').trim().replace(/\s+/g,' '));
        }
        json(res,{season:season?season[1]:'?',seasonEnd:endMatch?endMatch[1].trim():null,patches:patches.slice(0,5)});
      });
    }).on('error',function(){json(res,{error:'Failed'});});
    return;
  }
  if(url.match(/^\/api\/posts\/([a-z0-9]+)$/) && req.method === 'DELETE'){
    var id = url.match(/^\/api\/posts\/([a-z0-9]+)$/)[1];
    return body(req, function(data){
      json(res, forum.deletePost(id, data.deleteKey||''));
    });
  }
  if(url.match(/^\/api\/posts\/([a-z0-9]+)\/comment\/([a-z0-9]+)$/) && req.method === 'DELETE'){
    var m = url.match(/^\/api\/posts\/([a-z0-9]+)\/comment\/([a-z0-9]+)$/);
    return body(req, function(data){
      json(res, forum.deleteComment(m[1], m[2], data.deleteKey||'', data.isReply||false));
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
}).listen(port, () => console.log('Serving ' + root + ' at http://localhost:' + port + '/'));
