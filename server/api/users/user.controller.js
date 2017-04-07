const mongodb = require('./../../orm/mongodb');
const moment = require('moment');
const uuid = require('node-uuid');
const db_name = 'xz_sys';
const coll_name = 'user';
const coll_collection = 'user_collection';
const coll_usersite = 'UserSite';
const coll_applay = 'userApply';
const coll_note = 'UserNote';
const coll_userTopic = 'user_topic';
const coll_topicTemplate = 'topic_template';
const coll_websites = 'websites';

exports.findUser = async (ctx) => {
    let user = ctx.request.body;
    let query = {username: user.username, password: user.password};
    user = await mongodb.find(db_name, coll_name, query, null);
    let result = false;

    let userCollectionIDs = [];
    let frozen = 1;
    if (user.length > 0) {
        if(user[0].frozen == '1') {
            result = user[0].id;
            let userCollction = await mongodb.find(db_name, coll_collection, {userid: result}, null);
            userCollction = userCollction ? userCollction : [];
            if (userCollction.length > 0) {
                userCollction = userCollction[0];
                let infoCollections = userCollction.info_collection;
                for (let infoCollection of infoCollections) {
                    userCollectionIDs.push(infoCollection.id);
                }
            }
        }else{
            frozen = 0;
        }
    } else {
        result = false;
    }
    ctx.response.status = 200;
    ctx.response.body = {result: result, userCollectionIDs: userCollectionIDs,frozen:frozen};
};

exports.updateUser = async (ctx) => {
    let id = ctx.request.body.id;
    let type = ctx.request.body.type;
    let val = ctx.request.body.val;

    let filter = {id: id};
    let update = {$set: {[type]: val}};
    let resJson = await mongodb.updateUser(db_name, coll_name, filter, update);
    ctx.response.status = 200;
    ctx.response.body = {data: resJson};
};

exports.userInfo = async (ctx) => {
    let id = ctx.request.body.userId;
    let query = {id: id};
    let resJson = await mongodb.find(db_name, coll_name, query, null);
    let user = resJson[0];
    ctx.response.status = 200;
    ctx.response.body = {user: {name: user.username, password: user.password, company: user.company, nickname: user.nickname}};
};

exports.getUserCollection = async (ctx) => {
    let userID = ctx.request.body.userID;
    let infoCollections = [];
    let count = 0;
    if(userID) {
        let page = ctx.request.body.page;
        if(!page){
            page = 1;
        }
        let userCollection = await mongodb.find(db_name, coll_collection, [{userid: userID},{info_collection:{$slice:[page*20-20,20]}}],null);
        let tempCount = await mongodb.find(db_name, coll_collection, {userid: userID},null);
        if(tempCount&&tempCount.length>0){
            count = tempCount[0].info_collection.length;
        }
        if (userCollection != undefined && userCollection.length>0) {
            userCollection = userCollection[0];
            infoCollections = userCollection.info_collection;
        }
    }
    ctx.response.status = 200;
    ctx.response.body = {infoCollections: infoCollections,total:count};
};
exports.getUserSite = async (ctx) => {
    let userID = ctx.request.userID;
    let userSite = mongodb.find(db_name, coll_usersite, {userid: userID}, null);
    let cores = [];
    let importants = [];
    let normals = [];
    let websites;
    let keywords = [];
    if (userSite != undefined) {
        userSite = userSite[0];
        let sites = userSite.sites;
        for (let site of sites) {
            if ('core' == site.level) {
                cores.push(site);
            } else if ('important' == site.level) {
                importants.push(site);
            } else {
                normals.push(site);
            }
        }
        websites = {cores: cores, importants: importants, normals: normals};
        keywords = userSite.keywords;
    }
    ctx.response.status = 200;
    ctx.response.body = {websites: websites, keywords: keywords};
};

exports.getUserApply = async (ctx) => {
    let userID = ctx.request.body.userID;
    let userApplys = [];
    let count = 0;
    if(userID) {
        let page = ctx.request.body.page;
        if(!page){
            page = 1;
        }
        userApplys = await mongodb.find(db_name, coll_applay, {id: userID}, page*20-20);

        count = await mongodb.getCount(db_name, coll_applay, {id: userID});

        for (let userApply of userApplys) {
            delete userApply._id;
            delete userApply.remark;
            delete userApply.handler;
        }
    }
    ctx.response.status = 200;
    ctx.response.body = {userApplys: userApplys,totalPage:count};
};

exports.addUserApply = async (ctx) => {
    let body = ctx.request.body;
    if (body && body.id) {
        let time = moment().format('YYYY-MM-DD hh:mm:ss');
        let handler;
        let remark;
        let type;
        if (body.type && body.type == 'website') {
            type = 'website';
        } else {
            type = 'other';
        }
        let insert = {
            id: body.id, applicant: body.applicant, time: time,
            sitesLevle: body.sitesLevle, type: type, status: 'check',
            content: body.content, keyword: body.keyword,
            remark: remark, handler: handler
        };
        await mongodb.insert(db_name, coll_applay, insert);
    }
    ctx.response.status = 200;
};

exports.getNotes = async (ctx) => {
    let userid = ctx.request.body.userid;
    let page = ctx.request.body.page;
    let infos = await mongodb.find(db_name,coll_note,{userid:userid},page*20-20);
    let total = await mongodb.getCount(db_name,coll_note,{userid:userid},null);
    ctx.response.status = 200;
    ctx.response.body = {infos:infos,total:total};
};

exports.deleteNote = async (ctx) => {
    let id = ctx.request.body.id;
    await mongodb.deleteNote(db_name,coll_note,{id:id});
    ctx.response.status = 200;
};

exports.getTopic = async (ctx) => {
    let userID = ctx.request.body.userID;
    let topics = await mongodb.find(db_name,coll_userTopic,{userid:userID},null);
    topics = topics.reverse();
    let websites = [];
    let subscribered = [];
    let topicTemplates = [];
    let subscriberIDs = [];
    let notSubscriber = [];

    for(let topic of topics) {
        let cores = [];
        let importants = [];
        let normals = [];
        delete topic._id;
        for (let website of topic.website) {
            if ('core' == website.level) {
                cores.push(website);
            } else if ('important' == website.level) {
                importants.push(website);
            } else {
                normals.push(website);
            }
        }
        topic.cores = cores;
        topic.importants = importants;
        topic.normals = normals;
        delete topic.website;
    }
    let user = await mongodb.find(db_name,coll_name,{id:userID},null);
    if(user.length){
        user = user[0];
        subscriberIDs = user.userTopicId;
        topicTemplates = await mongodb.find(db_name,coll_topicTemplate,null,null);
        websites = await mongodb.find(db_name,coll_websites,null,null);
        for(let website of websites){
            delete website._id;
        }

        let flag = true;
        for(let topicTemplate of topicTemplates){
            let cores = [];
            let importants = [];
            let normals = [];
            for(let website of topicTemplate.website){
                if('core' == website.level){
                    cores.push(website);
                }else if('important' == website.level){
                    importants.push(website);
                }else {
                    normals.push(website);
                }
            }
            topicTemplate.cores = cores;
            topicTemplate.importants = importants;
            topicTemplate.normals = normals;
            delete topicTemplate.website;
            delete topicTemplate._id;
            delete topicTemplate.forbidID;
            for(let topicId of subscriberIDs){
                if(topicId == topicTemplate.id){
                    subscribered.push(topicTemplate);
                    flag = false;
                    break;
                }
            }
            if(flag){
                notSubscriber.push(topicTemplate);
            }
            flag = true;
        }
    }
    ctx.response.status = 200;
    ctx.response.body = {
        websites:websites,
        topics:topics,
        subscribered:subscribered,
        notSubscriber:notSubscriber
    }
};

exports.modifyTopic = async (ctx) => {
    let body = ctx.request.body;

    let program = body.program;
    let location = body.location;
    let organizaion = body.organization;
    let person = body.person;
    let tech = body.tech;
    let country = body.country;
    let topic = body.topic;//当前专题的名称
    let website = body.cores.concat(body.importants).concat(body.normals);
    /*id为当前选中的专题的id*/
    if(body.id == ''){
        if(topic != undefined && topic != '') {
            let order = '1';
            let id = uuid.v4();
            let insert = {
                id: id, order: order, topic: topic, location: location,
                organizaion: organizaion, userid: body.userid, person: person,
                tech: tech, program: program, country: country, website: website
            };
            await mongodb.insert(db_name, coll_userTopic, insert);
        }
    }else {
        let update = {location:location, organizaion:organizaion,person:person,
                    tech:tech,program:program,country:country,website:website};
        await mongodb.updateUser(db_name,coll_userTopic,{id:body.id},{$set:update});
    }
    ctx.response.status = 200;
};

exports.deleteTopic = async (ctx) => {
  let id = ctx.request.body.id;
  await mongodb.deleteNote(db_name,coll_userTopic,{id:id});
  ctx.response.status = 200;
};

exports.frozenUser = async (ctx) => {
    let username = ctx.request.body.username;
    if(username){
        await mongodb.updateUser(db_name,coll_name,{username:username},{$set:{frozen:'0'}});
    }
    ctx.status = 200;
};