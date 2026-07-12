var initSqlJs = require('sql.js');
var fs = require('fs');
var path = require('path');
var DB_PATH = path.join(__dirname, 'forum.db');
var db;
var MASTER_KEY = 'mhur_admin_2026';

function genId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
function saveDb(){try{fs.writeFileSync(DB_PATH, Buffer.from(db.export()));}catch(e){}}
function parseTags(t){try{return JSON.parse(t||'[]');}catch(e){return[];}}
function countComments(postId){var r=db.exec("SELECT COUNT(*) as c FROM comments WHERE postId='"+postId.replace(/'/g,"''")+"' AND replyTo IS NULL");return r.length&&r[0].values.length?r[0].values[0][0]:0;}
function esc(s){return String(s||'').replace(/'/g,"''");}
function rowToPost(r){return{id:r[0],buildCode:r[1]||'',title:r[2],description:r[3]||'',author:r[4],tags:parseTags(r[5]),category:r[6]||'',image:r[7]||'',pinned:r[8]||0,likes:r[9]||0,views:r[10]||0,createdAt:r[11],comments:countComments(r[0]),editedAt:r[13]||0};}

var api = {};

api.list = function(page, sort){
  var order = "pinned DESC, createdAt DESC";
  if(sort==='likes') order = "pinned DESC, likes DESC, createdAt DESC";
  else if(sort==='new') order = "pinned DESC, createdAt DESC";
  else order = "pinned DESC, views DESC, likes DESC, createdAt DESC";
  var total = db.exec("SELECT COUNT(*) FROM posts");
  var rows = db.exec("SELECT * FROM posts ORDER BY "+order+" LIMIT "+(page*20|0)+" OFFSET "+(((page||1)-1)*20|0));
  return {items:(rows[0]?rows[0].values:[]).map(rowToPost), total:total[0].values[0][0], page:page||1, perPage:20};
};

api.get = function(id){
  var rows = db.exec("SELECT * FROM posts WHERE id='"+esc(id)+"'");
  if(!rows.length||!rows[0].values.length)return null;
  db.run("UPDATE posts SET views=views+1 WHERE id='"+esc(id)+"'");saveDb();
  var r=rows[0].values[0],p=rowToPost(r);
  var crows=db.exec("SELECT * FROM comments WHERE postId='"+esc(id)+"' ORDER BY createdAt ASC");
  var cs=[];
  if(crows.length)cs=crows[0].values.map(function(c){return{id:c[0],text:c[2],author:c[3],createdAt:c[5],editedAt:c[6]||0,replyTo:c[7]};});
  var tl=[],rm={};
  cs.forEach(function(c){if(c.replyTo){if(!rm[c.replyTo])rm[c.replyTo]=[];rm[c.replyTo].push(c);}else tl.push(c);});
  tl.forEach(function(c){if(rm[c.id])c.replies=rm[c.id];});
  p.comments=tl;
  return p;
};

api.create = function(data){
  var id=genId(),title=(data.title||'').trim();
  if(!title)return{error:'Title is required'};
  var tags=JSON.stringify((data.tags||[]).map(function(t){return t.trim().toLowerCase();}).filter(Boolean));
  db.run("INSERT INTO posts VALUES('"+esc(id)+"','"+esc(data.buildCode||'')+"','"+esc(title)+"','"+esc((data.description||'').trim())+"','"+esc((data.author||'Anonymous').trim())+"','"+esc(tags)+"','"+esc(data.category||'')+"','"+esc(data.image||'')+"',0,0,0,"+Date.now()+",'"+esc(data.deleteKey||'')+"',0)");
  saveDb();
  return{id:id,buildCode:data.buildCode||'',title:title,description:(data.description||'').trim(),author:(data.author||'Anonymous').trim(),tags:(data.tags||[]).map(function(t){return t.trim().toLowerCase();}).filter(Boolean),category:data.category||'',image:data.image||'',pinned:0,likes:0,views:0,createdAt:Date.now(),comments:[],deleteKey:data.deleteKey,editedAt:0};
};

api.deletePost = function(id,key){
  var r=db.exec("SELECT deleteKey FROM posts WHERE id='"+esc(id)+"'");
  if(!r.length||!r[0].values.length)return{error:'Not found'};
  if(r[0].values[0][0]!==key&&key!==MASTER_KEY)return{error:'Wrong key'};
  db.run("DELETE FROM posts WHERE id='"+esc(id)+"'");db.run("DELETE FROM comments WHERE postId='"+esc(id)+"'");saveDb();
  return{deleted:true};
};

api.deleteComment = function(postId,commentId,key,isReply){
  var col=isReply?'replyTo':'id';
  var r=db.exec("SELECT deleteKey FROM comments WHERE "+col+"='"+esc(commentId)+"' AND postId='"+esc(postId)+"'");
  if(!r.length||!r[0].values.length)return{error:'Not found'};
  if(r[0].values[0][0]!==key&&key!==MASTER_KEY)return{error:'Wrong key'};
  db.run("DELETE FROM comments WHERE "+col+"='"+esc(commentId)+"' AND postId='"+esc(postId)+"'");saveDb();
  return{deleted:true};
};

api.editPost = function(id,data,key){
  var r=db.exec("SELECT deleteKey FROM posts WHERE id='"+esc(id)+"'");
  if(!r.length||!r[0].values.length)return{error:'Not found'};
  if(r[0].values[0][0]!==key&&key!==MASTER_KEY)return{error:'Wrong key'};
  var sets=[];if(data.title!==undefined){sets.push("title='"+esc((data.title||'').trim())+"'");}
  if(data.description!==undefined){sets.push("description='"+esc((data.description||'').trim())+"'");}
  if(data.tags!==undefined){sets.push("tags='"+esc(JSON.stringify((data.tags||[]).map(function(t){return t.trim().toLowerCase();}).filter(Boolean)))+"'");}
  if(data.buildCode!==undefined){sets.push("buildCode='"+esc(data.buildCode||'')+"'");}
  sets.push("editedAt="+Date.now());
  db.run("UPDATE posts SET "+sets.join(",")+" WHERE id='"+esc(id)+"'");saveDb();
  return{edited:true,editedAt:Date.now()};
};

api.editComment = function(postId,commentId,data,key,isReply){
  var col=isReply?'replyTo':'id';
  var r=db.exec("SELECT deleteKey FROM comments WHERE "+col+"='"+esc(commentId)+"' AND postId='"+esc(postId)+"'");
  if(!r.length||!r[0].values.length)return{error:'Not found'};
  if(r[0].values[0][0]!==key&&key!==MASTER_KEY)return{error:'Wrong key'};
  if(data.text!==undefined)db.run("UPDATE comments SET text='"+esc((data.text||'').trim())+"',editedAt="+Date.now()+" WHERE "+col+"='"+esc(commentId)+"' AND postId='"+esc(postId)+"'");saveDb();
  return{edited:true,editedAt:Date.now()};
};

api.like = function(id){db.run("UPDATE posts SET likes=likes+1 WHERE id='"+esc(id)+"'");saveDb();var r=db.exec("SELECT likes FROM posts WHERE id='"+esc(id)+"'");return r.length&&r[0].values.length?{likes:r[0].values[0][0]}:{error:'Not found'};};
api.unlike = function(id){db.run("UPDATE posts SET likes=MAX(0,likes-1) WHERE id='"+esc(id)+"'");saveDb();var r=db.exec("SELECT likes FROM posts WHERE id='"+esc(id)+"'");return r.length&&r[0].values.length?{likes:r[0].values[0][0]}:{error:'Not found'};};

api.togglePin = function(id,key){
  if(key!==MASTER_KEY)return{error:'Wrong key'};
  db.run("UPDATE posts SET pinned = CASE WHEN pinned=1 THEN 0 ELSE 1 END WHERE id='"+esc(id)+"'");saveDb();
  var r=db.exec("SELECT pinned FROM posts WHERE id='"+esc(id)+"'");
  return r.length&&r[0].values.length?{pinned:r[0].values[0][0]}:{error:'Not found'};
};

api.comment = function(id,data){
  var cid=genId(),text=(data.text||'').trim();
  if(!text)return{error:'Comment text is required'};
  db.run("INSERT INTO comments VALUES('"+esc(cid)+"','"+esc(id)+"','"+esc(text)+"','"+esc((data.author||'').trim()||'Anonymous')+"','"+esc(data.deleteKey||'')+"',"+Date.now()+",0,"+(data.replyTo?"'"+esc(data.replyTo)+"'":"NULL")+")");saveDb();
  return{id:cid,text:text,author:(data.author||'').trim()||'Anonymous',createdAt:Date.now()};
};

api.search = function(q){
  var query=(q||'').toLowerCase().trim();
  if(!query)return[];
  var rows=db.exec("SELECT * FROM posts WHERE LOWER(title) LIKE '%"+esc(query)+"%' OR LOWER(author) LIKE '%"+esc(query)+"%' OR LOWER(description) LIKE '%"+esc(query)+"%' OR LOWER(tags) LIKE '%"+esc(query)+"%' ORDER BY pinned DESC, likes DESC, createdAt DESC LIMIT 50");
  return(rows[0]?rows[0].values:[]).map(rowToPost);
};

module.exports = initSqlJs().then(function(SQL){
  try{db=new SQL.Database(fs.readFileSync(DB_PATH));}catch(e){db=new SQL.Database();}
  db.run("CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, buildCode TEXT, title TEXT, description TEXT, author TEXT, tags TEXT, category TEXT, image TEXT, pinned INTEGER DEFAULT 0, likes INTEGER DEFAULT 0, views INTEGER DEFAULT 0, createdAt INTEGER, deleteKey TEXT, editedAt INTEGER)");
  db.run("CREATE TABLE IF NOT EXISTS comments (id TEXT, postId TEXT, text TEXT, author TEXT, deleteKey TEXT, createdAt INTEGER, editedAt INTEGER, replyTo TEXT)");
  saveDb();
  return api;
});
