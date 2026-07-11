var fs = require('fs');
var path = require('path');
var DB_PATH = path.join(__dirname, 'forum_posts.json');
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
  writeQueue = writeQueue.then(function(){
    return new Promise(function(resolve){
      fs.writeFileSync(DB_PATH, JSON.stringify(posts, null, 2), 'utf8');
      resolve();
    });
  });
}

function genId(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

exports.list = function(page, sort){
  var posts = load();
  var perPage = 20;
  if(sort === 'likes'){
    posts.sort(function(a,b){ return (b.likes||0) - (a.likes||0) || b.createdAt - a.createdAt; });
  }else if(sort === 'new'){
    posts.sort(function(a,b){ return b.createdAt - a.createdAt; });
  }else{
    posts.sort(function(a,b){ return (b.views||0) - (a.views||0) || (b.likes||0) - (a.likes||0) || b.createdAt - a.createdAt; });
  }
  function countComments(comments){
    if(!comments)return 0;
    var n=comments.length;
    for(var i=0;i<comments.length;i++){if(comments[i].replies)n+=comments[i].replies.length;}
    return n;
  }
  var start = ((page||1)-1) * perPage;
  var items = posts.slice(start, start + perPage).map(function(p){
    return { id:p.id, title:p.title, author:p.author, tags:p.tags||[], likes:p.likes||0, comments:countComments(p.comments), createdAt:p.createdAt, buildCode:p.buildCode };
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
      if(posts[i].deleteKey !== key) return {error:'Wrong key'};
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
      if(posts[i].deleteKey !== key) return {error:'Wrong key'};
      if(!posts[i].comments) return {error:'No comments'};
      for(var j=0;j<posts[i].comments.length;j++){
        var cm = posts[i].comments[j];
        if(isReply && cm.replies){
          for(var k=0;k<cm.replies.length;k++){
            if(cm.replies[k].id === commentId){
              if(cm.replies[k].deleteKey !== key) return {error:'Wrong key for reply'};
              cm.replies.splice(k,1);
              save(posts);
              return {deleted:true};
            }
          }
        }else if(!isReply && cm.id === commentId){
          if(cm.deleteKey !== key) return {error:'Wrong key for comment'};
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

exports.create = function(data){
  var posts = load();
  var post = {
    id: genId(),
    buildCode: data.buildCode || '',
    title: (data.title || '').trim(),
    description: (data.description || '').trim(),
    author: (data.author || 'Anonymous').trim(),
    tags: (data.tags || []).map(function(t){return t.trim().toLowerCase();}).filter(Boolean),
    likes: 0,
    views: 0,
    createdAt: Date.now(),
    deleteKey: data.deleteKey || '',
    comments: []
  };
  if(!post.title){ return {error:'Title is required'}; }
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

exports.search = function(q){
  var posts = load();
  var query = q.toLowerCase().trim();
  if(!query){ return []; }
  return posts.filter(function(p){
    return (p.title||'').toLowerCase().indexOf(query) !== -1 ||
           (p.author||'').toLowerCase().indexOf(query) !== -1 ||
           (p.description||'').toLowerCase().indexOf(query) !== -1 ||
           (p.tags||[]).some(function(t){ return t.indexOf(query) !== -1; }) ||
           (p.buildCode||'').indexOf(query) !== -1;
  }).slice(0, 50).map(function(p){
    return { id:p.id, title:p.title, author:p.author, tags:p.tags||[], likes:p.likes||0, comments:countComments(p.comments), createdAt:p.createdAt };
  });
};
