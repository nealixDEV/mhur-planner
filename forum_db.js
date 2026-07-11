var fs = require('fs');
var path = require('path');
var DB_PATH = path.join(__dirname, 'forum_posts.json');
var MASTER_KEY = 'mhur_admin_2026';
var writeQueue = Promise.resolve();

function load(){
  try{
    var raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  }catch(e){
    return [];
  }
}

function save(posts){
  fs.writeFileSync(DB_PATH, JSON.stringify(posts, null, 2), 'utf8');
}

function genId(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function countComments(comments){
  if(!comments)return 0;
  var n=comments.length;
  for(var i=0;i<comments.length;i++){if(comments[i].replies)n+=comments[i].replies.length;}
  return n;
}

exports.list = function(page, sort){
  var posts = load();
  var perPage = 20;
  posts.sort(function(a,b){
    if((a.pinned||0)!==(b.pinned||0))return (b.pinned||0) - (a.pinned||0);
    if(sort === 'likes') return (b.likes||0) - (a.likes||0) || b.createdAt - a.createdAt;
    if(sort === 'new') return b.createdAt - a.createdAt;
    return (b.views||0) - (a.views||0) || (b.likes||0) - (a.likes||0) || b.createdAt - a.createdAt;
  });
  var start = ((page||1)-1) * perPage;
  var items = posts.slice(start, start + perPage).map(function(p){
    return { id:p.id, title:p.title, author:p.author, tags:p.tags||[], category:p.category||'', pinned:p.pinned||0, image:p.image||'', likes:p.likes||0, comments:countComments(p.comments), createdAt:p.createdAt, buildCode:p.buildCode };
  });
  return { items:items, total:posts.length, page:page||1, perPage:perPage };
};

function stripKey(post){
  if(!post)return null;
  var out = JSON.parse(JSON.stringify(post));
  delete out.deleteKey;
  if(out.comments){
    for(var i=0;i<out.comments.length;i++){
      delete out.comments[i].deleteKey;
      if(out.comments[i].replies){
        for(var j=0;j<out.comments[i].replies.length;j++){
          delete out.comments[i].replies[j].deleteKey;
        }
      }
    }
  }
  return out;
}

exports.get = function(id){
  var posts = load();
  for(var i=0;i<posts.length;i++){
    if(posts[i].id === id){
      posts[i].views = (posts[i].views||0) + 1;
      save(posts);
      return stripKey(posts[i]);
    }
  }
  return null;
};

exports.deletePost = function(id, key){
  var posts = load();
  for(var i=0;i<posts.length;i++){
    if(posts[i].id === id){
      if(posts[i].deleteKey !== key && key !== MASTER_KEY) return {error:'Wrong key'};
      posts.splice(i,1);
      save(posts);
      return {deleted:true};
    }
  }
  return {error:'Not found'};
};

exports.deleteComment = function(postId, commentId, key, isReply){
  var posts = load();
  for(var i=0;i<posts.length;i++){
    if(posts[i].id === postId){
      if(posts[i].deleteKey !== key && key !== MASTER_KEY) return {error:'Wrong key'};
      if(!posts[i].comments) return {error:'No comments'};
      for(var j=0;j<posts[i].comments.length;j++){
        var cm = posts[i].comments[j];
        if(isReply && cm.replies){
          for(var k=0;k<cm.replies.length;k++){
            if(cm.replies[k].id === commentId){
              if(cm.replies[k].deleteKey !== key && key !== MASTER_KEY) return {error:'Wrong key for reply'};
              cm.replies.splice(k,1);
              save(posts);
              return {deleted:true};
            }
          }
        }else if(!isReply && cm.id === commentId){
          if(cm.deleteKey !== key && key !== MASTER_KEY) return {error:'Wrong key for comment'};
          posts[i].comments.splice(j,1);
          save(posts);
          return {deleted:true};
        }
      }
      return {error:'Comment not found'};
    }
  }
  return {error:'Not found'};
};

exports.editPost = function(id, data, key){
  var posts = load();
  for(var i=0;i<posts.length;i++){
    if(posts[i].id === id){
      if(posts[i].deleteKey !== key && key !== MASTER_KEY) return {error:'Wrong key'};
      if(data.title!==undefined) posts[i].title = (data.title||'').trim();
      if(data.description!==undefined) posts[i].description = (data.description||'').trim();
      if(data.tags!==undefined) posts[i].tags = (data.tags||[]).map(function(t){return t.trim().toLowerCase();}).filter(Boolean);
      if(data.buildCode!==undefined) posts[i].buildCode = data.buildCode || '';
      posts[i].editedAt = Date.now();
      save(posts);
      return {edited:true, editedAt:posts[i].editedAt, title:posts[i].title, description:posts[i].description, tags:posts[i].tags, buildCode:posts[i].buildCode};
    }
  }
  return {error:'Not found'};
};

exports.editComment = function(postId, commentId, data, key, isReply){
  var posts = load();
  for(var i=0;i<posts.length;i++){
    if(posts[i].id === postId){
      if(!posts[i].comments) return {error:'No comments'};
      for(var j=0;j<posts[i].comments.length;j++){
        var cm = posts[i].comments[j];
        if(isReply && cm.replies){
          for(var k=0;k<cm.replies.length;k++){
            if(cm.replies[k].id === commentId){
              if(cm.replies[k].deleteKey !== key) return {error:'Wrong key'};
              if(data.text!==undefined) cm.replies[k].text = (data.text||'').trim();
              cm.replies[k].editedAt = Date.now();
              save(posts);
              return {edited:true, editedAt:cm.replies[k].editedAt};
            }
          }
        }else if(!isReply && cm.id === commentId){
          if(cm.deleteKey !== key) return {error:'Wrong key'};
          if(data.text!==undefined) cm.text = (data.text||'').trim();
          cm.editedAt = Date.now();
          save(posts);
          return {edited:true, editedAt:cm.editedAt};
        }
      }
      return {error:'Comment not found'};
    }
  }
  return {error:'Not found'};
};

exports.create = function(data){
  var posts = load();
  var post = {
    id: genId(),
    buildCode: data.buildCode || '',
    title: (data.title || '').trim(),
    description: (data.description || '').trim(),
    author: (data.author || 'Anonymous').trim(),
    tags: (data.tags || []).map(function(t){return t.trim().toLowerCase();}).filter(Boolean),
    category: data.category || '',
    pinned: data.pinned ? 1 : 0,
    likes: 0,
    views: 0,
    createdAt: Date.now(),
    deleteKey: data.deleteKey || '',
    comments: []
  };
  if(!post.title){ return {error:'Title is required'}; }
  if(data.image) post.image = data.image;
  posts.unshift(post);
  save(posts);
  var out = JSON.parse(JSON.stringify(post));
  delete out.deleteKey;
  out.deleteKey = post.deleteKey;
  return out;
};

exports.like = function(id){
  var posts = load();
  for(var i=0;i<posts.length;i++){
    if(posts[i].id === id){
      posts[i].likes = (posts[i].likes||0) + 1;
      save(posts);
      return { likes: posts[i].likes };
    }
  }
  return {error:'Not found'};
};
exports.unlike = function(id){
  var posts = load();
  for(var i=0;i<posts.length;i++){
    if(posts[i].id === id){
      posts[i].likes = Math.max(0, (posts[i].likes||0) - 1);
      save(posts);
      return { likes: posts[i].likes };
    }
  }
  return {error:'Not found'};
};

exports.comment = function(id, data){
  var posts = load();
  for(var i=0;i<posts.length;i++){
    if(posts[i].id === id){
      var c = {
        id: genId(),
        text: (data.text||'').trim(),
        author: (data.author||'').trim()||'Anonymous',
        deleteKey: data.deleteKey || '',
        createdAt: Date.now()
      };
      if(!c.text){ return {error:'Comment text is required'}; }
      if(!posts[i].comments){ posts[i].comments = []; }
      if(data.replyTo){
        for(var j=0;j<posts[i].comments.length;j++){
          if(posts[i].comments[j].id === data.replyTo){
            if(!posts[i].comments[j].replies) posts[i].comments[j].replies = [];
            posts[i].comments[j].replies.push(c);
            save(posts);
            return c;
          }
        }
      }
      posts[i].comments.push(c);
      save(posts);
      return c;
    }
  }
  return {error:'Not found'};
};
exports.togglePin = function(id, key){
  var posts = load();
  for(var i=0;i<posts.length;i++){
    if(posts[i].id === id){
      if(key !== MASTER_KEY) return {error:'Wrong key'};
      posts[i].pinned = posts[i].pinned ? 0 : 1;
      save(posts);
      return {pinned:posts[i].pinned};
    }
  }
  return {error:'Not found'};
};
exports.search = function(q){
  var posts = load();
  var query = q.toLowerCase().trim();
  if(!query){ return []; }
  var aliases={
    deku:['izuku','midoriya'],'izuku midoriya':['deku','midoriya','izuku'],
    bakugo:['katsuki','bakugou'],katsuki:['bakugo','bakugou'],
    ochaco:['uraraka','ochako'],uraraka:['ochaco','ochako'],
    shoto:['todoroki','shouto'],todoroki:['shoto','shouto'],
    tenya:['iida','tenya'],iida:['tenya'],
    tsuyu:['asui','tsuyu','froppy'],asui:['tsuyu','froppy'],
    eijiro:['kirishima','red','eijirou','kiri'],kirishima:['eijiro','red','kiri'],
    momo:['yaoyorozu'],yaoyorozu:['momo'],
    fumikage:['tokoyami','dark shadow','fumi'],tokoyami:['fumikage','dark shadow'],
    denki:['kaminari','denki','pikachu'],kaminari:['denki','pikachu'],
    kendo:['itsuka','kendo'],'itsuka':['kendo'],
    ibara:['shiozaki','ibara'],shiozaki:['ibara'],
    mirio:['togata','mirio','lemillion'],togata:['mirio','lemillion'],
    tamaki:['amajiki','tamaki','suneater'],amajiki:['tamaki','suneater'],
    nejire:['hado','nejire','nejire-chan'],hado:['nejire'],
    hitoshi:['shinso','hitoshi','shinsou'],shinso:['hitoshi','shinsou'],
    allmight:['all might','allmight','yagi','toshinori','symbol of peace'],
    aizawa:['shota','aizawa','eraserhead','shouta'],'shota':['aizawa','eraserhead'],
    mic:['present mic','mic','present','yamada','hizashi'],'present mic':['mic','present mic'],
    cement:['cementoss','cement','isoda','ken'],
    endeavor:['endeavor','enji','todoroki','flame'],
    hawks:['hawks','keigo','takami','fierce wings'],
    mirko:['mirko','rumi','usagiyama'],
    star:['star and stripe','star','cathleen','bate','stars'],
    mtlady:['mt lady','mtlady','yu','takeyama','gigantification'],
    tomura:['shigaraki','tomura','shiggy','decay'],shigaraki:['tomura','shiggy','decay'],
    afo:['all for one','afo','allforone'],'all for one':['afo','allforone'],
    dabi:['dabi','toya','touya','todoroki'],
    toga:['himiko','toga','himiko toga'],'himiko':['toga'],
    twice:['twice','jin','bubaigawara'],
    compress:['mr compress','compress','sako','oguro','mr.compress'],'mr compress':['compress'],
    kurogiri:['kurogiri','oboro','shirakumo'],
    nagant:['lady nagant','nagant','kaina','tsutsumi'],'lady nagant':['nagant'],
    overhaul:['overhaul','chisaki','kai','shie hassaikai'],
    'izuku ofa':['ofa','one for all','100%','izuku ofa','full cowling','deku ofa'],
    armored:['armored all might','armored','all might armored'],
    'afo youth':['afo young','young afo','afo youth','all for one young'],
    'rapid deku':['izuku ofa','ofa','deku rapid','rapid izuku'],
    'red riot':['eijiro','kirishima','red','unbreakable'],
    'shiggy':['tomura','shigaraki'],
    'eraser':['aizawa','shota','eraserhead'],
    'mha':[],'mhur':[],'ultra rumble':[],'my hero':[]
  };
  var expanded=[query];
  if(aliases[query])expanded=expanded.concat(aliases[query]);
  for(var key in aliases){
    if(aliases[key].indexOf(query)!==-1)expanded.push(key);
  }
  return posts.filter(function(p){
    var text=(p.title||'').toLowerCase()+' '+(p.author||'').toLowerCase()+' '+(p.description||'').toLowerCase()+' '+(p.tags||[]).join(' ')+' '+(p.buildCode||'');
    try{
      var bc=JSON.parse(decodeURIComponent(escape(atob(p.buildCode||''))));
      if(bc.charId)text+=' '+bc.charId;
      if(bc.label)text+=' '+bc.label.toLowerCase();
      // Add character role from CH array lookup
      var chNames={izuku:'assault',izuku_ofa:'rapid',katsuki:'strike',ochaco:'rapid',tenya:'rapid',tsuyu:'rapid',shoto:'strike',eijiro:'assault',momo:'support',fumikage:'assault',denki:'strike',neito:'technical',kendo:'assault',ibara:'support',mirio:'rapid',tamaki:'strike',nejire:'technical',hitoshi:'strike',allmight:'assault',armored:'technical',aizawa:'technical',mic:'strike',cement:'support',endeavor:'strike',hawks:'rapid',mirko:'rapid',star:'strike',mtlady:'assault',tomura:'strike',afo:'technical',afo_youth:'assault',dabi:'technical',himiko:'technical',twice:'rapid',compress:'support',kurogiri:'support',nagant:'strike',overhaul:'support'};
      if(chNames[bc.charId])text+=' '+chNames[bc.charId];
    }catch(e){}
    for(var i=0;i<expanded.length;i++){
      if(text.indexOf(expanded[i])!==-1)return true;
    }
    return false;
  }).slice(0, 50).map(function(p){
    return { id:p.id, title:p.title, author:p.author, tags:p.tags||[], likes:p.likes||0, comments:countComments(p.comments), createdAt:p.createdAt };
  });
};
