var fs = require('fs');
var path = require('path');
var MASTER_KEY = 'mhur_admin_2026';
var DB_PATH = path.join(__dirname, 'forum.db');
var api = {};
var usePG = !!process.env.DATABASE_URL;
var db;

function genId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
function parseTags(t){try{return JSON.parse(t||'[]');}catch(e){return[];}}

function q(sql,params,cb){
  if(usePG){
    db.query(sql,params,function(err,res){
      if(cb)cb(err?null:res);
    });
  }else{
    var r = db.exec(sql);
    if(cb)cb(r);
  }
}

function qOne(sql,params,cb){
  if(usePG){
    db.query(sql,params,function(err,res){
      cb(err||!res.rows.length?null:res.rows[0]);
    });
  }else{
    var r = db.exec(sql);
    cb(r[0]&&r[0].values[0]?function(){var cols=r[0].columns,vals=r[0].values[0],o={};for(var i=0;i<cols.length;i++)o[cols[i]]=vals[i];return o;}():null);
  }
}

function qAll(sql,params,cb){
  if(usePG){
    db.query(sql,params,function(err,res){
      cb(err?[]:res.rows);
    });
  }else{
    var r = db.exec(sql);
    cb(r[0]?r[0].values.map(function(v){var cols=r[0].columns,o={};for(var i=0;i<cols.length;i++)o[cols[i]]=v[i];return o;}):[]);
  }
}

function qRun(sql,params,cb){
  if(usePG){
    db.query(sql,params,function(err,res){save();if(cb)cb(res);});
  }else{
    db.run(sql);
    save();
    if(cb)cb();
  }
}

function save(){
  if(!usePG){
    try{fs.writeFileSync(DB_PATH,Buffer.from(db.export()));}catch(e){}
  }
}

function rowToPost(r,cc){
  return {id:r.id,buildCode:r.buildcode||'',title:r.title,description:r.description||'',author:r.author,tags:parseTags(r.tags),category:r.category||'',image:r.image||'',pinned:r.pinned||0,likes:r.likes||0,views:r.views||0,createdAt:r.createdat||r.createdAt,comments:cc||0,editedAt:r.editedat||r.editedAt||0};
}

module.exports = new Promise(function(resolve){
  if(usePG){
    var pg = require('pg');
    db = new pg.Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
    db.connect(function(err){
      if(err){console.log('PG error:',err.message);process.exit(1);}
      db.query("CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, buildCode TEXT, title TEXT, description TEXT, author TEXT, tags TEXT, category TEXT, image TEXT, pinned INTEGER DEFAULT 0, likes INTEGER DEFAULT 0, views INTEGER DEFAULT 0, createdAt BIGINT, deleteKey TEXT, editedAt BIGINT)",[],function(){
        db.query("CREATE TABLE IF NOT EXISTS comments (id TEXT, postId TEXT, text TEXT, author TEXT, deleteKey TEXT, createdAt BIGINT, editedAt BIGINT, replyTo TEXT)",[],function(){
          console.log('PostgreSQL connected');
          resolve(buildAPI());
        });
      });
    });
  }else{
    var initSqlJs = require('sql.js');
    initSqlJs().then(function(SQL){
      try{db=new SQL.Database(fs.readFileSync(DB_PATH));}catch(e){db=new SQL.Database();}
      db.run("CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, buildCode TEXT, title TEXT, description TEXT, author TEXT, tags TEXT, category TEXT, image TEXT, pinned INTEGER DEFAULT 0, likes INTEGER DEFAULT 0, views INTEGER DEFAULT 0, createdAt INTEGER, deleteKey TEXT, editedAt INTEGER)");
      db.run("CREATE TABLE IF NOT EXISTS comments (id TEXT, postId TEXT, text TEXT, author TEXT, deleteKey TEXT, createdAt INTEGER, editedAt INTEGER, replyTo TEXT)");
      save();
      console.log('SQLite ready');
      resolve(buildAPI());
    });
  }
});

function buildAPI(){
  var a = {};

  a.list = function(page,sort,cb){
    var order = "pinned DESC, createdAt DESC";
    if(sort==='likes')order="pinned DESC, likes DESC, createdAt DESC";
    else if(sort==='new')order="pinned DESC, createdAt DESC";
    var off=((page||1)-1)*20;
    qAll("SELECT * FROM posts ORDER BY "+order+" LIMIT 20 OFFSET "+off,[],function(rows){
      qOne("SELECT COUNT(*) as c FROM posts",[],function(tot){
        var pending=rows.length,items=[];
        if(!pending){cb({items:[],total:tot?tot.c:0,page:page||1,perPage:20});return;}
        rows.forEach(function(r){
          qOne("SELECT COUNT(*) as c FROM comments WHERE postId=$1 AND replyTo IS NULL",[r.id],function(cc){
            items.push(rowToPost(r,cc?cc.c:0));
            if(--pending===0)cb({items:items,total:tot?tot.c:0,page:page||1,perPage:20});
          });
        });
      });
    });
  };

  a.get = function(id,cb){
    qOne("SELECT * FROM posts WHERE id=$1",[id],function(r){
      if(!r){cb(null);return;}
      qRun("UPDATE posts SET views=views+1 WHERE id=$1",[id]);
      qAll("SELECT * FROM comments WHERE postId=$1 ORDER BY createdAt ASC",[id],function(crows){
        var cs=crows.map(function(c){return{id:c.id,text:c.text,author:c.author,createdAt:c.createdat||c.createdAt,editedAt:c.editedat||c.editedAt||0,replyTo:c.replyto||c.replyTo};});
        var tl=[],rm={};
        cs.forEach(function(c){if(c.replyTo){if(!rm[c.replyTo])rm[c.replyTo]=[];rm[c.replyTo].push(c);}else tl.push(c);});
        tl.forEach(function(c){if(rm[c.id])c.replies=rm[c.id];});
        var p=rowToPost(r,cs.length);
        p.comments=tl;
        cb(p);
      });
    });
  };

  a.create = function(data,cb){
    var id=genId(),title=(data.title||'').trim();
    if(!title){cb({error:'Title is required'});return;}
    var tags=JSON.stringify((data.tags||[]).map(function(t){return t.trim().toLowerCase();}).filter(Boolean));
    qRun("INSERT INTO posts(id,buildCode,title,description,author,tags,category,image,pinned,likes,views,createdAt,deleteKey,editedAt) VALUES($1,$2,$3,$4,$5,$6,$7,$8,0,0,0,$9,$10,0)",
      [id,data.buildCode||'',title,(data.description||'').trim(),(data.author||'Anonymous').trim(),tags,data.category||'',data.image||'',Date.now(),data.deleteKey||''],function(){
      cb({id:id,buildCode:data.buildCode||'',title:title,description:(data.description||'').trim(),author:(data.author||'Anonymous').trim(),tags:(data.tags||[]).map(function(t){return t.trim().toLowerCase();}).filter(Boolean),category:data.category||'',image:data.image||'',pinned:0,likes:0,views:0,createdAt:Date.now(),comments:[],deleteKey:data.deleteKey,editedAt:0});
    });
  };

  a.deletePost = function(id,key,cb){
    qOne("SELECT deleteKey FROM posts WHERE id=$1",[id],function(r){
      if(!r){cb({error:'Not found'});return;}
      if(r.deletekey!==key&&key!==MASTER_KEY){cb({error:'Wrong key'});return;}
      qRun("DELETE FROM posts WHERE id=$1",[id]);qRun("DELETE FROM comments WHERE postId=$1",[id]);cb({deleted:true});
    });
  };

  a.deleteComment = function(postId,commentId,key,isReply,cb){
    var col=isReply?'replyTo':'id';
    qOne("SELECT deleteKey FROM comments WHERE "+col+"=$1 AND postId=$2",[commentId,postId],function(r){
      if(!r){cb({error:'Not found'});return;}
      if(r.deletekey!==key&&key!==MASTER_KEY){cb({error:'Wrong key'});return;}
      qRun("DELETE FROM comments WHERE "+col+"=$1 AND postId=$2",[commentId,postId]);cb({deleted:true});
    });
  };

  a.editPost = function(id,data,key,cb){
    qOne("SELECT deleteKey FROM posts WHERE id=$1",[id],function(r){
      if(!r){cb({error:'Not found'});return;}
      if(r.deletekey!==key&&key!==MASTER_KEY){cb({error:'Wrong key'});return;}
      var s=[],v=[],n=1;
      if(data.title!==undefined){s.push("title=$"+n++);v.push((data.title||'').trim());}
      if(data.description!==undefined){s.push("description=$"+n++);v.push((data.description||'').trim());}
      if(data.tags!==undefined){s.push("tags=$"+n++);v.push(JSON.stringify((data.tags||[]).map(function(t){return t.trim().toLowerCase();}).filter(Boolean)));}
      if(data.buildCode!==undefined){s.push("buildCode=$"+n++);v.push(data.buildCode||'');}
      s.push("editedAt=$"+n++);v.push(Date.now());v.push(id);
      qRun("UPDATE posts SET "+s.join(",")+" WHERE id=$"+n,v,function(){cb({edited:true,editedAt:Date.now()});});
    });
  };

  a.editComment = function(postId,commentId,data,key,isReply,cb){
    var col=isReply?'replyTo':'id';
    qOne("SELECT deleteKey FROM comments WHERE "+col+"=$1 AND postId=$2",[commentId,postId],function(r){
      if(!r){cb({error:'Not found'});return;}
      if(r.deletekey!==key&&key!==MASTER_KEY){cb({error:'Wrong key'});return;}
      if(data.text!==undefined)qRun("UPDATE comments SET text=$1,editedAt=$2 WHERE "+col+"=$3 AND postId=$4",[(data.text||'').trim(),Date.now(),commentId,postId]);
      cb({edited:true,editedAt:Date.now()});
    });
  };

  a.like = function(id,cb){qRun("UPDATE posts SET likes=likes+1 WHERE id=$1",[id]);qOne("SELECT likes FROM posts WHERE id=$1",[id],function(r){cb(r?{likes:r.likes}:{error:'Not found'});});};
  a.unlike = function(id,cb){qRun("UPDATE posts SET likes=GREATEST(0,likes-1) WHERE id=$1",[id]);qOne("SELECT likes FROM posts WHERE id=$1",[id],function(r){cb(r?{likes:r.likes}:{error:'Not found'});});};

  a.togglePin = function(id,key,cb){
    if(key!==MASTER_KEY){cb({error:'Wrong key'});return;}
    qRun("UPDATE posts SET pinned = CASE WHEN pinned=1 THEN 0 ELSE 1 END WHERE id=$1",[id]);
    qOne("SELECT pinned FROM posts WHERE id=$1",[id],function(r){cb(r?{pinned:r.pinned}:{error:'Not found'});});
  };

  a.comment = function(id,data,cb){
    var cid=genId(),text=(data.text||'').trim();
    if(!text){cb({error:'Comment text is required'});return;}
    qRun("INSERT INTO comments(id,postId,text,author,deleteKey,createdAt,editedAt,replyTo) VALUES($1,$2,$3,$4,$5,$6,0,$7)",
      [cid,id,text,(data.author||'').trim()||'Anonymous',data.deleteKey||'',Date.now(),data.replyTo||null],function(){cb({id:cid,text:text,author:(data.author||'').trim()||'Anonymous',createdAt:Date.now()});});
  };

  a.search = function(query,cb){
    var qs=(query||'').toLowerCase().trim();
    if(!qs){cb([]);return;}
    qAll("SELECT * FROM posts WHERE LOWER(title) LIKE $1 OR LOWER(author) LIKE $1 OR LOWER(description) LIKE $1 OR LOWER(tags) LIKE $1 ORDER BY pinned DESC, likes DESC, createdAt DESC LIMIT 50",['%'+qs+'%'],function(rows){
      var pending=rows.length,items=[];
      if(!pending){cb([]);return;}
      rows.forEach(function(r){
        qOne("SELECT COUNT(*) as c FROM comments WHERE postId=$1 AND replyTo IS NULL",[r.id],function(cc){
          items.push(rowToPost(r,cc?cc.c:0));
          if(--pending===0)cb(items);
        });
      });
    });
  };

  return a;
}
