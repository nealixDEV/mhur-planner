var fs = require('fs');
var path = require('path');
var MASTER_KEY = 'mhur_admin_2026';
var DB_PATH = path.join(__dirname, 'forum.db');
var api = {};
var usePG = !!process.env.DATABASE_URL;
var db;
var CHAR_NAMES={
  izuku:"Izuku Midoriya",izuku_ofa:"Izuku Midoriya (OFA)",katsuki:"Katsuki Bakugo",
  ochaco:"Ochaco Uraraka",tenya:"Tenya Iida",tsuyu:"Tsuyu Asui",shoto:"Shoto Todoroki",
  eijiro:"Eijiro Kirishima",momo:"Momo Yaoyorozu",fumikage:"Fumikage Tokoyami",
  denki:"Denki Kaminari",neito:"Neito Monoma",kendo:"Itsuka Kendo",ibara:"Ibara Shiozaki",
  mirio:"Mirio Togata",tamaki:"Tamaki Amajiki",nejire:"Nejire Hado",hitoshi:"Hitoshi Shinso",
  allmight:"All Might",armored:"Armored All Might",aizawa:"Shota Aizawa",
  mic:"Present Mic",cement:"Cementoss",endeavor:"Endeavor",hawks:"Hawks",
  mirko:"Mirko",star:"Star and Stripe",mtlady:"Mt. Lady",tomura:"Tomura Shigaraki",
  afo:"All For One",afo_youth:"All For One (Youth)",dabi:"Dabi",himiko:"Himiko Toga",
  twice:"Twice",compress:"Mr. Compress",kurogiri:"Kurogiri",nagant:"Lady Nagant",
  overhaul:"Overhaul"
};


function genId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
function parseTags(t){try{return JSON.parse(t||'[]');}catch(e){return[];}}

function esc(v){
  if(v===null||v===undefined)return'NULL';
  if(typeof v==='number')return String(v);
  return"'"+(String(v).replace(/'/g,"''"))+"'";
}
function fill(sql,params){
  if(!params||!params.length)return sql;
  var i=0;
  return sql.replace(/\$\d+/g,function(){return esc(params[i++]);});
}

function q(sql,params,cb){
  if(usePG){
    db.query(sql,params,function(err,res){
      if(cb)cb(err?null:res);
    });
  }else{
    var r = db.exec(fill(sql,params));
    if(cb)cb(r);
  }
}

function qOne(sql,params,cb){
  if(usePG){
    db.query(sql,params,function(err,res){
      cb(err||!res.rows.length?null:res.rows[0]);
    });
  }else{
    var r = db.exec(fill(sql,params));
    cb(r[0]&&r[0].values[0]?function(){var cols=r[0].columns,vals=r[0].values[0],o={};for(var i=0;i<cols.length;i++)o[cols[i]]=vals[i];return o;}():null);
  }
}

function qAll(sql,params,cb){
  if(usePG){
    db.query(sql,params,function(err,res){
      cb(err?[]:res.rows);
    });
  }else{
    var r = db.exec(fill(sql,params));
    cb(r[0]?r[0].values.map(function(v){var cols=r[0].columns,o={};for(var i=0;i<cols.length;i++)o[cols[i]]=v[i];return o;}):[]);
  }
}

function qRun(sql,params,cb){
  if(usePG){
    db.query(sql,params,function(err,res){save();if(cb)cb(err?false:true);});
  }else{
    db.run(fill(sql,params));
    save();
    if(cb)cb(true);
  }
}

function save(){
  if(!usePG){
    try{fs.writeFileSync(DB_PATH,Buffer.from(db.export()));}catch(e){}
  }
}

var _userCache={};
function getUserCached(username,cb){
  var key=(username||'').toLowerCase();
  if(_userCache[key]){cb(_userCache[key]);return;}
  qOne("SELECT admin,avatar FROM forum_users WHERE username=$1",[key],function(r){
    _userCache[key]=r||{admin:0,avatar:''};cb(_userCache[key]);
  });
}
function rowToPost(r,cc,userData){
  userData=userData||_userCache[(r.author||'').toLowerCase()];
  return {id:r.id,buildCode:r.buildcode||r.buildCode||'',title:r.title,description:r.description||'',author:r.author,authorAdmin:(userData?userData.admin:0),authorAvatar:(userData?userData.avatar:''),tags:parseTags(r.tags),category:r.category||'',image:r.image||r.image||'',pinned:r.pinned||0,likes:r.likes||0,views:r.views||0,createdAt:r.createdat||r.createdAt,comments:cc||0,editedAt:r.editedat||r.editedAt||0};
}

module.exports = new Promise(function(resolve){
  if(usePG){
    var pg = require('pg');
    db = new pg.Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
    db.connect(function(err){
      if(err){console.log('PG error:',err.message);process.exit(1);}
      db.query("CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, buildCode TEXT, title TEXT, description TEXT, author TEXT, tags TEXT, category TEXT, image TEXT, pinned INTEGER DEFAULT 0, likes INTEGER DEFAULT 0, views INTEGER DEFAULT 0, createdAt BIGINT, deleteKey TEXT, editedAt BIGINT)",[],function(){
        db.query("CREATE TABLE IF NOT EXISTS comments (id TEXT, postId TEXT, text TEXT, author TEXT, deleteKey TEXT, createdAt BIGINT, editedAt BIGINT, replyTo TEXT, image TEXT)",[],function(){
        db.query("ALTER TABLE comments ADD COLUMN IF NOT EXISTS image TEXT",[],function(){
        db.query("CREATE TABLE IF NOT EXISTS uploads (id TEXT PRIMARY KEY, data TEXT, mime TEXT, createdAt BIGINT)",[],function(){
        db.query("CREATE TABLE IF NOT EXISTS forum_users (username TEXT PRIMARY KEY, createdAt BIGINT, admin INTEGER DEFAULT 0)",[],function(){
        db.query("ALTER TABLE forum_users ADD COLUMN IF NOT EXISTS admin INTEGER DEFAULT 0",[],function(){
        db.query("ALTER TABLE forum_users ADD COLUMN IF NOT EXISTS avatar TEXT",[],function(){
        db.query("ALTER TABLE forum_users ADD COLUMN IF NOT EXISTS password TEXT",[],function(){
        db.query("ALTER TABLE forum_users ADD COLUMN IF NOT EXISTS banner TEXT",[],function(){
        db.query("ALTER TABLE forum_users ADD COLUMN IF NOT EXISTS bannerdesc TEXT",[],function(){
        db.query("ALTER TABLE forum_users ADD COLUMN IF NOT EXISTS links TEXT",[],function(){
        db.query("ALTER TABLE forum_users ADD COLUMN IF NOT EXISTS banned INTEGER DEFAULT 0",[],function(){
        db.query("ALTER TABLE forum_users ADD COLUMN IF NOT EXISTS muted_until BIGINT DEFAULT 0",[],function(){
        db.query("ALTER TABLE forum_users ADD COLUMN IF NOT EXISTS warnings TEXT",[],function(){
        db.query("ALTER TABLE forum_users ADD COLUMN IF NOT EXISTS title TEXT",[],function(){
        db.query("ALTER TABLE forum_users ADD COLUMN IF NOT EXISTS title_color TEXT",[],function(){
        db.query("CREATE TABLE IF NOT EXISTS used_admin_keys (key_hash TEXT PRIMARY KEY, usedAt BIGINT)",[],function(){
        db.query("CREATE TABLE IF NOT EXISTS admin_keys (key_id TEXT PRIMARY KEY, used INTEGER DEFAULT 0, createdAt BIGINT)",[],function(){
          console.log('PostgreSQL connected');
          resolve(buildAPI());
        });
        });
        });
        });
        });
        });
        });
      });
    });
    });
    });
    });
    });
    });
    });
    });
    });
    });
    });
  }else{
    var initSqlJs = require('sql.js');
    initSqlJs().then(function(SQL){
      try{db=new SQL.Database(fs.readFileSync(DB_PATH));}catch(e){db=new SQL.Database();}
      db.run("CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, buildCode TEXT, title TEXT, description TEXT, author TEXT, tags TEXT, category TEXT, image TEXT, pinned INTEGER DEFAULT 0, likes INTEGER DEFAULT 0, views INTEGER DEFAULT 0, createdAt INTEGER, deleteKey TEXT, editedAt INTEGER)");
      db.run("CREATE TABLE IF NOT EXISTS comments (id TEXT, postId TEXT, text TEXT, author TEXT, deleteKey TEXT, createdAt INTEGER, editedAt INTEGER, replyTo TEXT, image TEXT)");
      try{db.run("ALTER TABLE comments ADD COLUMN image TEXT");}catch(e){}
      db.run("CREATE TABLE IF NOT EXISTS uploads (id TEXT PRIMARY KEY, data TEXT, mime TEXT, createdAt INTEGER)");
      db.run("CREATE TABLE IF NOT EXISTS forum_users (username TEXT PRIMARY KEY, createdAt INTEGER, admin INTEGER DEFAULT 0)");
      try{db.run("ALTER TABLE forum_users ADD COLUMN admin INTEGER DEFAULT 0");}catch(e){}
      try{db.run("ALTER TABLE forum_users ADD COLUMN avatar TEXT");}catch(e){}
      try{db.run("ALTER TABLE forum_users ADD COLUMN password TEXT");}catch(e){}
      try{db.run("ALTER TABLE forum_users ADD COLUMN banner TEXT");}catch(e){}
      try{db.run("ALTER TABLE forum_users ADD COLUMN bannerDesc TEXT");}catch(e){}
      try{db.run("ALTER TABLE forum_users ADD COLUMN links TEXT");}catch(e){}
      try{db.run("ALTER TABLE forum_users ADD COLUMN banned INTEGER DEFAULT 0");}catch(e){}
      try{db.run("ALTER TABLE forum_users ADD COLUMN muted_until INTEGER DEFAULT 0");}catch(e){}
      try{db.run("ALTER TABLE forum_users ADD COLUMN warnings TEXT");}catch(e){}
      try{db.run("ALTER TABLE forum_users ADD COLUMN title TEXT");}catch(e){}
      try{db.run("ALTER TABLE forum_users ADD COLUMN title_color TEXT");}catch(e){}
      db.run("CREATE TABLE IF NOT EXISTS used_admin_keys (key_hash TEXT PRIMARY KEY, usedAt INTEGER)");
      db.run("CREATE TABLE IF NOT EXISTS admin_keys (key_id TEXT PRIMARY KEY, used INTEGER DEFAULT 0, createdAt INTEGER)");
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
        var pending=rows.length,items=[],authors={};
        if(!pending){cb({items:[],total:tot?tot.c:0,page:page||1,perPage:20});return;}
        rows.forEach(function(r){if(r.author)authors[r.author]=true;});
        var authorList=Object.keys(authors),authorPending=authorList.length;
        function finish(){
          rows.forEach(function(r){
            qOne("SELECT COUNT(*) as c FROM comments WHERE postId=$1 AND replyTo IS NULL",[r.id],function(cc){
              items.push(rowToPost(r,cc?cc.c:0,_userCache[r.author]));
              if(--pending===0)cb({items:items,total:tot?tot.c:0,page:page||1,perPage:20});
            });
          });
        }
        if(!authorPending){finish();return;}
        authorList.forEach(function(u){
          getUserCached(u,function(){if(--authorPending===0)finish();});
        });
      });
    });
  };

  a.get = function(id,cb){
    qOne("SELECT * FROM posts WHERE id=$1",[id],function(r){
      if(!r){cb(null);return;}
      qRun("UPDATE posts SET views=views+1 WHERE id=$1",[id]);
      qAll("SELECT * FROM comments WHERE postId=$1 ORDER BY createdAt ASC",[id],function(crows){
        var authors={};if(r.author)authors[r.author]=true;
        crows.forEach(function(c){if(c.author)authors[c.author]=true;});
        var authorList=Object.keys(authors),authorPending=authorList.length;
        function finishGet(){
          var cs=crows.map(function(c){var uData=_userCache[(c.author||'').toLowerCase()];return{id:c.id,text:c.text,author:c.author,authorAdmin:(uData?uData.admin:0),authorAvatar:(uData?uData.avatar:''),image:c.image||'',createdAt:c.createdat||c.createdAt,editedAt:c.editedat||c.editedAt||0,replyTo:c.replyto||c.replyTo};});
          var tl=[],rm={};
          cs.forEach(function(c){if(c.replyTo){if(!rm[c.replyTo])rm[c.replyTo]=[];rm[c.replyTo].push(c);}else tl.push(c);});
          tl.forEach(function(c){if(rm[c.id])c.replies=rm[c.id];});
          var p=rowToPost(r,cs.length);
          p.comments=tl;
          cb(p);
        }
        if(!authorPending){finishGet();return;}
        authorList.forEach(function(u){
          getUserCached(u,function(){if(--authorPending===0)finishGet();});
        });
      });
    });
  };

  a.create = function(data,cb){
    var author=(data.author||'').trim();
    if(author){
      qOne("SELECT banned,muted_until FROM forum_users WHERE username=$1",[author.toLowerCase()],function(u){
        if(u&&u.banned){cb({error:'Your account has been banned from posting.'});return;}
        if(u&&u.muted_until&&u.muted_until>Date.now()){cb({error:'You are muted for '+Math.ceil((u.muted_until-Date.now())/60000)+' more minutes.'});return;}
        doCreate();
      });
    }else{doCreate();}
    function doCreate(){
    var id=genId(),title=(data.title||'').trim();
    if(!title){cb({error:'Title is required'});return;}
    var tags=JSON.stringify((data.tags||[]).map(function(t){return t.trim().toLowerCase();}).filter(Boolean));
    qRun("INSERT INTO posts(id,buildCode,title,description,author,tags,category,image,pinned,likes,views,createdAt,deleteKey,editedAt) VALUES($1,$2,$3,$4,$5,$6,$7,$8,0,0,0,$9,$10,0)",
      [id,data.buildCode||'',title,(data.description||'').trim(),(data.author||'Anonymous').trim(),tags,data.category||'',data.image||'',Date.now(),data.deleteKey||''],function(){
      cb({id:id,buildCode:data.buildCode||'',title:title,description:(data.description||'').trim(),author:(data.author||'Anonymous').trim(),tags:(data.tags||[]).map(function(t){return t.trim().toLowerCase();}).filter(Boolean),category:data.category||'',image:data.image||'',pinned:0,likes:0,views:0,createdAt:Date.now(),comments:[],deleteKey:data.deleteKey,editedAt:0});
    });
    }
  };

  function dk(r){return r.deletekey||r.deleteKey||'';}
  function checkAdmin(key,cb,doOp){
    isAdminKey(key,function(admin){if(!admin){cb({error:'Wrong key'});return;}doOp();});
  }

  a.deletePost = function(id,key,cb){
    qOne("SELECT deleteKey FROM posts WHERE id=$1",[id],function(r){
      if(!r){cb({error:'Not found'});return;}
      if(dk(r)===key){qRun("DELETE FROM posts WHERE id=$1",[id]);qRun("DELETE FROM comments WHERE postId=$1",[id]);cb({deleted:true});return;}
      checkAdmin(key,cb,function(){qRun("DELETE FROM posts WHERE id=$1",[id]);qRun("DELETE FROM comments WHERE postId=$1",[id]);cb({deleted:true});});
    });
  };

  a.deleteComment = function(postId,commentId,key,isReply,cb){
    var col=isReply?'replyTo':'id';
    qOne("SELECT deleteKey FROM comments WHERE "+col+"=$1 AND postId=$2",[commentId,postId],function(r){
      if(!r){cb({error:'Not found'});return;}
      if(dk(r)===key){qRun("DELETE FROM comments WHERE "+col+"=$1 AND postId=$2",[commentId,postId]);cb({deleted:true});return;}
      checkAdmin(key,cb,function(){qRun("DELETE FROM comments WHERE "+col+"=$1 AND postId=$2",[commentId,postId]);cb({deleted:true});});
    });
  };

  a.editPost = function(id,data,key,cb){
    qOne("SELECT deleteKey FROM posts WHERE id=$1",[id],function(r){
      if(!r){cb({error:'Not found'});return;}
      function doEdit(){
        var s=[],v=[],n=1;
        if(data.title!==undefined){s.push("title=$"+n++);v.push((data.title||'').trim());}
        if(data.description!==undefined){s.push("description=$"+n++);v.push((data.description||'').trim());}
        if(data.tags!==undefined){s.push("tags=$"+n++);v.push(JSON.stringify((data.tags||[]).map(function(t){return t.trim().toLowerCase();}).filter(Boolean)));}
        if(data.buildCode!==undefined){s.push("buildCode=$"+n++);v.push(data.buildCode||'');}
        s.push("editedAt=$"+n++);v.push(Date.now());v.push(id);
        qRun("UPDATE posts SET "+s.join(",")+" WHERE id=$"+n,v,function(){cb({edited:true,editedAt:Date.now()});});
      }
      if(dk(r)===key){doEdit();return;}
      checkAdmin(key,cb,doEdit);
    });
  };

  a.editComment = function(postId,commentId,data,key,isReply,cb){
    var col=isReply?'replyTo':'id';
    qOne("SELECT deleteKey FROM comments WHERE "+col+"=$1 AND postId=$2",[commentId,postId],function(r){
      if(!r){cb({error:'Not found'});return;}
      function doEdit2(){
        if(data.text!==undefined)qRun("UPDATE comments SET text=$1,editedAt=$2 WHERE "+col+"=$3 AND postId=$4",[(data.text||'').trim(),Date.now(),commentId,postId]);
        cb({edited:true,editedAt:Date.now()});
      }
      if(dk(r)===key){doEdit2();return;}
      checkAdmin(key,cb,doEdit2);
    });
  };

function isAdminKey(key,cb){
  if(key===MASTER_KEY){cb(true);return;}
  if(typeof key==='string'&&key.indexOf('user:')===0){
    var un=key.substring(5).toLowerCase().trim();
    qOne("SELECT admin FROM forum_users WHERE username=$1 AND admin>=1",[un],function(r){cb(!!r);});
    return;
  }
  qOne("SELECT used FROM admin_keys WHERE key_id=$1 AND used=1",[key],function(r){cb(!!r);});
  }
  a.like = function(id,cb){qRun("UPDATE posts SET likes=likes+1 WHERE id=$1",[id]);qOne("SELECT likes FROM posts WHERE id=$1",[id],function(r){cb(r?{likes:r.likes}:{error:'Not found'});});};
  a.unlike = function(id,cb){qRun("UPDATE posts SET likes=CASE WHEN likes>0 THEN likes-1 ELSE 0 END WHERE id=$1",[id]);qOne("SELECT likes FROM posts WHERE id=$1",[id],function(r){cb(r?{likes:r.likes}:{error:'Not found'});});};

  a.togglePin = function(id,key,cb){
    isAdminKey(key,function(admin){
      if(!admin){cb({error:'Wrong key'});return;}
      qRun("UPDATE posts SET pinned = CASE WHEN pinned=1 THEN 0 ELSE 1 END WHERE id=$1",[id]);
      qOne("SELECT pinned FROM posts WHERE id=$1",[id],function(r){cb(r?{pinned:r.pinned}:{error:'Not found'});});
    });
  };

  a.comment = function(id,data,cb){
    var ca=(data.author||'').trim();
    if(ca){
      qOne("SELECT banned,muted_until FROM forum_users WHERE username=$1",[ca.toLowerCase()],function(u){
        if(u&&u.banned){cb({error:'Your account has been banned from posting.'});return;}
        if(u&&u.muted_until&&u.muted_until>Date.now()){cb({error:'You are muted for '+Math.ceil((u.muted_until-Date.now())/60000)+' more minutes.'});return;}
        doComment();
      });
    }else{doComment();}
    function doComment(){
    var cid=genId(),text=(data.text||'').trim();
    if(!text&&!data.image){cb({error:'Comment text or image is required'});return;}
    var img=data.image||'';
    qRun("INSERT INTO comments(id,postId,text,author,deleteKey,createdAt,editedAt,replyTo,image) VALUES($1,$2,$3,$4,$5,$6,0,$7,$8)",
      [cid,id,text,(data.author||'').trim()||'Anonymous',data.deleteKey||'',Date.now(),data.replyTo||null,img],function(){cb({id:cid,text:text,author:(data.author||'').trim()||'Anonymous',createdAt:Date.now(),image:img});});
    }
  };

  function buildCodeMatch(qs,row){
    var bc=row.buildcode||row.buildCode;
    if(!bc)return false;
    try{
      var p=JSON.parse(decodeURIComponent(escape(atob(bc))));
      if(!p)return false;
      var sid=p.charId||'';
      var cname=(CHAR_NAMES[sid]||'').toLowerCase();
      if(cname.indexOf(qs)>=0)return true;
      if(sid.indexOf(qs)>=0)return true;
      var lbl=(p.label||'').toLowerCase();
      if(lbl.indexOf(qs)>=0)return true;
    }catch(e){}
    return false;
  }
  a.search = function(query,cb){
    var qs=(query||'').toLowerCase().trim();
    if(!qs){cb([]);return;}
    qAll("SELECT * FROM posts WHERE LOWER(title) LIKE $1 OR LOWER(author) LIKE $1 OR LOWER(description) LIKE $1 OR LOWER(tags) LIKE $1 ORDER BY pinned DESC, likes DESC, createdAt DESC LIMIT 50",['%'+qs+'%'],function(rows){
      var matched=[],extra=[];
      rows.forEach(function(r){
        var rr=r;if(usePG)rr=r;
        matched.push(rr);
      });
      // If few results, also scan posts whose build code matches
      if(matched.length<20){
        qAll("SELECT * FROM posts ORDER BY pinned DESC, likes DESC, createdAt DESC LIMIT 100",[],function(allRows){
          allRows.forEach(function(r){
            if(matched.indexOf(r)>=0)return;
            if(buildCodeMatch(qs,r))matched.push(r);
          });
          var pending=matched.length,items=[];
          if(!pending){cb([]);return;}
          matched.forEach(function(r){
            qOne("SELECT COUNT(*) as c FROM comments WHERE postId=$1 AND replyTo IS NULL",[r.id],function(cc){
              items.push(rowToPost(r,cc?cc.c:0));
              if(--pending===0)cb(items);
            });
          });
    });
  }else{
        var pending=matched.length,items=[];
        if(!pending){cb([]);return;}
        matched.forEach(function(r){
          qOne("SELECT COUNT(*) as c FROM comments WHERE postId=$1 AND replyTo IS NULL",[r.id],function(cc){
            items.push(rowToPost(r,cc?cc.c:0));
            if(--pending===0)cb(items);
          });
        });
      }
    });
  };

  a.saveUpload = function(id, data, mime, cb){
    qRun("INSERT INTO uploads(id,data,mime,createdAt) VALUES($1,$2,$3,$4)",[id,data,mime,Date.now()],function(ok){
      cb(ok);
    });
  };
  a.getUpload = function(id, cb){
    qOne("SELECT id,data,mime FROM uploads WHERE id=$1",[id],function(r){
      cb(r||null);
    });
  };

  function hashPw(p){var c=require('crypto');return c.createHash('sha256').update(String(p||'')).digest('hex');}
  a.registerUser = function(data, cb){
    var username=(typeof data==='string'?data:data&&data.username)||'';
    if(!username||!username.trim()){cb({error:'Username is required'});return;}
    var name=username.trim().toLowerCase();
    if(name.length<2||name.length>20){cb({error:'Username must be 2-20 characters'});return;}
    if(!/^[a-z0-9_]+$/.test(name)){cb({error:'Username can only contain letters, numbers, and underscores'});return;}
    var pw=data.password||'';
    if(pw.length<3){cb({error:'Password must be at least 3 characters'});return;}
    var hpw=hashPw(pw);
    qOne("SELECT username FROM forum_users WHERE password=$1",[hpw],function(existingPw){
      if(existingPw){cb({error:'Password already in use by another account'});return;}
      a.checkUserExists(name,function(exists){
      if(exists){cb({error:'Username already taken'});return;}
      var avatar=data.avatar||'';
      qRun("INSERT INTO forum_users(username,createdAt,admin,avatar,password) VALUES($1,$2,0,$3,$4)",[name,Date.now(),avatar,hashPw(pw)],function(){
        cb({registered:true,username:name,avatar:avatar});
      });
    });
    });
  };
  a.changePassword = function(username, oldPw, newPw, cb){
    if(!username||!oldPw||!newPw){cb({error:'All fields required'});return;}
    if(newPw.length<3){cb({error:'New password must be 3+ characters'});return;}
    var uname=username.toLowerCase().trim();
    var newHash=hashPw(newPw);
    // Check if new password is unique (exclude current user)
    qOne("SELECT username FROM forum_users WHERE password=$1 AND username!=$2",[newHash,uname],function(existing){
      if(existing){cb({error:'New password already in use by another account'});return;}
      // Verify old password
      qOne("SELECT password FROM forum_users WHERE username=$1",[uname],function(r){
        if(!r){cb({error:'Account not found'});return;}
        if(r.password&&r.password!==hashPw(oldPw)){cb({error:'Current password is incorrect'});return;}
        qRun("UPDATE forum_users SET password=$1 WHERE username=$2",[newHash,uname],function(){
          cb({changed:true});
        });
      });
    });
  };
  a.login = function(username, password, cb){
    if(!username||!password){cb({error:'Username and password required'});return;}
    var uname=username.toLowerCase().trim();
    // First check if account exists and has a password
    qOne("SELECT password FROM forum_users WHERE username=$1",[uname],function(r){
      if(!r){cb({error:'Account not found'});return;}
      if(!r.password){
        // Account exists but no password set — set it now
        qRun("UPDATE forum_users SET password=$1 WHERE username=$2",[hashPw(password),uname],function(){
          qOne("SELECT username,admin,avatar FROM forum_users WHERE username=$1",[uname],function(r2){
            cb({success:true,username:r2.username,admin:r2.admin,avatar:r2.avatar||'',firstLogin:true});
          });
        });
      }else{
        qOne("SELECT username,admin,avatar FROM forum_users WHERE username=$1 AND password=$2",[uname,hashPw(password)],function(r2){
          if(!r2){cb({error:'Invalid password'});return;}
          cb({success:true,username:r2.username,admin:r2.admin,avatar:r2.avatar||''});
        });
      }
    });
  };
  a.checkUserExists = function(username, cb){
    qOne("SELECT username FROM forum_users WHERE username=$1",[username.toLowerCase().trim()],function(r){
      cb(!!r);
    });
  };
  a.listUsers = function(cb){
    qAll("SELECT username,admin,createdAt FROM forum_users ORDER BY username ASC",[],function(rows){
      cb(rows||[]);
    });
  };
  a.isAdminUser = function(username, cb){
    qOne("SELECT admin FROM forum_users WHERE username=$1",[username.toLowerCase().trim()],function(r){
      cb(r&&r.admin>=1);
    });
  };
  a.listAdmins = function(cb){
    qAll("SELECT username,admin FROM forum_users WHERE admin>=1 ORDER BY admin DESC, username ASC",[],function(rows){
      cb(rows||[]);
    });
  };
  a.demoteUser = function(adminUsername, targetUsername, cb){
    // Only owner (admin=2) can demote. Check caller is owner.
    a.getUser(adminUsername,function(caller){
      if(!caller||caller.admin<2){cb({error:'Only the owner can demote admins'});return;}
      qRun("UPDATE forum_users SET admin=CASE WHEN admin=2 THEN 2 ELSE 0 END WHERE username=$1 AND admin=1",[targetUsername.toLowerCase().trim()],function(){
        cb({demoted:true});
      });
    });
  };
  a.banUser = function(adminUsername, targetUsername, reason, cb){
    a.getUser(adminUsername,function(caller){
      if(!caller||caller.admin<2){cb({error:'Only the owner can ban users'});return;}
      qRun("UPDATE forum_users SET banned=1 WHERE username=$1",[targetUsername.toLowerCase().trim()],function(){
        if(reason){var w=JSON.stringify([{type:'ban',reason:reason,date:Date.now(),by:adminUsername}]);qRun("UPDATE forum_users SET warnings=$1 WHERE username=$2",[w,targetUsername.toLowerCase().trim()],function(){cb({banned:true});});}else{cb({banned:true});}
      });
    });
  };
  a.unbanUser = function(adminUsername, targetUsername, cb){
    a.getUser(adminUsername,function(caller){
      if(!caller||caller.admin<2){cb({error:'Only the owner can unban users'});return;}
      qRun("UPDATE forum_users SET banned=0 WHERE username=$1",[targetUsername.toLowerCase().trim()],function(){cb({unbanned:true});});
    });
  };
  a.muteUser = function(adminUsername, targetUsername, durationMs, cb){
    a.getUser(adminUsername,function(caller){
      if(!caller||caller.admin<2){cb({error:'Only the owner can mute users'});return;}
      qRun("UPDATE forum_users SET muted_until=$1 WHERE username=$2",[Date.now()+durationMs,targetUsername.toLowerCase().trim()],function(){cb({muted:true});});
    });
  };
  a.unmuteUser = function(adminUsername, targetUsername, cb){
    a.getUser(adminUsername,function(caller){
      if(!caller||caller.admin<2){cb({error:'Only the owner can unmute users'});return;}
      qRun("UPDATE forum_users SET muted_until=0 WHERE username=$1",[targetUsername.toLowerCase().trim()],function(){cb({unmuted:true});});
    });
  };
  a.warnUser = function(adminUsername, targetUsername, reason, cb){
    a.getUser(adminUsername,function(caller){
      if(!caller||caller.admin<2){cb({error:'Only the owner can warn users'});return;}
      a.getUser(targetUsername,function(u){
        var warnings=[];try{warnings=JSON.parse(u.warnings||'[]');}catch(e){}
        warnings.push({type:'warn',reason:reason,date:Date.now(),by:adminUsername});
        qRun("UPDATE forum_users SET warnings=$1 WHERE username=$2",[JSON.stringify(warnings),targetUsername.toLowerCase().trim()],function(){cb({warned:true,warnings:warnings});});
      });
    });
  };

  a.isKeyUsed = function(key, cb){
    qOne("SELECT key_id FROM admin_keys WHERE key_id=$1 AND used=0",[key],function(r){
      cb(!r);
    });
  };
  a.markKeyUsed = function(key, cb){
    qRun("UPDATE admin_keys SET used=1 WHERE key_id=$1",[key],cb);
  };
  a.generateAdminKeys = function(count, prefix, cb){
    if(typeof prefix==='function'){cb=prefix;prefix='mhur_admin_';}
    prefix=prefix||'mhur_admin_';
    var keys=[],pending=count;
    for(var i=0;i<count;i++){
      var k=prefix+(Math.random().toString(36).slice(2,8));
      keys.push(k);
      qRun("INSERT INTO admin_keys(key_id,used,createdAt) VALUES($1,0,$2)",[k,Date.now()],function(){
        if(--pending===0&&cb)cb(keys);
      });
    }
  };
  a.listAdminKeys = function(cb){
    qAll("SELECT key_id,used FROM admin_keys ORDER BY createdAt DESC",[],function(rows){
      cb(rows||[]);
    });
  };
  a.setUserAdmin = function(username, level, cb){
    if(typeof level==='function'){cb=level;level=1;}
    qRun("UPDATE forum_users SET admin=$1 WHERE username=$2",[level||1,username.toLowerCase().trim()],cb);
  };
  a.setUserAvatar = function(username, avatar, cb){
    qRun("UPDATE forum_users SET avatar=$1 WHERE username=$2",[avatar,username.toLowerCase().trim()],cb);
  };
  a.setUserBanner = function(username, banner, cb){
    qRun("UPDATE forum_users SET banner=$1 WHERE username=$2",[banner,username.toLowerCase().trim()],cb);
  };
  a.setUserBannerDesc = function(username, desc, cb){
    qRun("UPDATE forum_users SET bannerdesc=$1 WHERE username=$2",[desc,username.toLowerCase().trim()],cb);
  };
  a.setUserLinks = function(username, links, cb){
    qRun("UPDATE forum_users SET links=$1 WHERE username=$2",[links,username.toLowerCase().trim()],cb);
  };
  a.getUser = function(username, cb){
    qOne("SELECT username,admin,avatar,banner,bannerdesc,links,title,title_color FROM forum_users WHERE username=$1",[username.toLowerCase().trim()],function(r){
      cb(r||null);
    });
  };
  a.setUserTitle = function(username, title, cb){
    qRun("UPDATE forum_users SET title=$1 WHERE username=$2",[title,username.toLowerCase().trim()],cb||function(){});
  };
  a.setUserTitleColor = function(username, color, cb){
    qRun("UPDATE forum_users SET title_color=$1 WHERE username=$2",[color,username.toLowerCase().trim()],cb||function(){});
  };
  a.getUserTitles = function(username, cb){
    var qs=username.toLowerCase().trim();
    qOne("SELECT COUNT(*) as postCount FROM posts WHERE LOWER(author)=$1",[qs],function(pc){
      var postCount=pc?pc.postCount||0:0;
      qOne("SELECT COALESCE(SUM(likes),0) as totalLikes FROM posts WHERE LOWER(author)=$1",[qs],function(lr){
        var totalLikes=lr?lr.totalLikes||0:0;
        var titles=[];
        if(postCount>=5)titles.push({id:'tuning_enthusiast',name:'Tuning Enthusiast',req:'5 posts'});
        if(postCount>=10&&totalLikes>=10)titles.push({id:'master_tuning_poster',name:'Master Tuning Poster',req:'10 posts with 10+ likes'});
        if(postCount>=20&&totalLikes>=10)titles.push({id:'pro_tuner',name:'Pro Tuner',req:'20 posts with 10+ likes'});
        cb({titles:titles,postCount:postCount,totalLikes:totalLikes});
      });
    });
  };
  a.listByAuthor = function(author, page, cb){
    var qs=(author||'').toLowerCase().trim();
    if(!qs){cb({items:[],total:0});return;}
    var off=((page||1)-1)*20;
    qAll("SELECT * FROM posts WHERE LOWER(author)=$1 ORDER BY createdAt DESC LIMIT 20 OFFSET $2",[qs,off],function(rows){
      qOne("SELECT COUNT(*) as c FROM posts WHERE LOWER(author)=$1",[qs],function(tot){
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

  return a;
}

