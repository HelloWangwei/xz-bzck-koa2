const mongodb = require('./../../orm/mongodb');
const moment = require('moment');
const uuid = require('node-uuid');

const db_name = 'xz_sys';
const coll_websites = 'websites';
const coll_userSite = 'UserSite';
const coll_userNote = 'UserNote';

exports.userWebsitesInit = async (ctx) => {
    let userid = ctx.request.body.userid;

    let cores = [];
    let importants = [];
    let normals = [];
    let websites = [];
    let keywords = [];

    let urls = [];

    //获取用户已保存信息
    let query = {userid: userid};
    let userSites = await mongodb.find(db_name, coll_userSite, query, null);

    if (userSites.length > 0) {
        userSites = userSites[0];

        let sites = userSites.sites;
        for (let site of sites) {
            if (site.level == 'core') {
                cores.push(site);
            } else if (site.level == 'important') {
                importants.push(site);
            } else {
                normals.push(site);
            }
            urls.push(site.url);
        }

        keywords = userSites.keywords;
    }

    //获取所有网站信息 并去重用户已关注的
    let flag = true;
    query = {};
    let initWebsites = await mongodb.find(db_name, coll_websites, query, null);
    if (initWebsites.length > 0) {
        for (let site of initWebsites) {
            for (let url of urls) {
                if (url == site.url) {
                    flag = false;
                    break;
                }
            }
            if (flag) {
                websites.push(site);
            }
            flag = true;
        }
    }


    ctx.response.status = 200;
    ctx.response.body = {
        websites: websites,
        normals: normals,
        cores: cores,
        importants: importants,
        keywords: keywords
    };
};


exports.siteFocusSetSave = async (ctx) => {
    let userid = ctx.request.body.userid;
    let cores = ctx.request.body.cores;
    let importants = ctx.request.body.importants;
    let normals = ctx.request.body.normals;
    let keywords = ctx.request.body.keywords;

    cores = cores ? cores : [];
    importants = importants ? importants : [];
    normals = normals ? normals : [];
    let sites = cores.concat(importants).concat(normals);
    let insert = {
        userid: userid,
        sites: sites,
        keywords: keywords,
        lastlogintime: moment().format('YYYY-MM-DD hh:mm:ss')
    };

    //查询之前用户是否已保存
    let query = {userid: userid};
    let userSites = await mongodb.find(db_name, coll_userSite, query, null);

    if (userSites.length > 0) {
        await mongodb.replace(db_name, coll_userSite, query, insert);
    } else {
        await mongodb.insert(db_name, coll_userSite, insert);
    }

    ctx.response.status = 200;
};

exports.getWebSitesInfo = async (ctx) => {
    let userid = ctx.params.userid;
    let res = await mongodb.getWebSitesInfo(userid);
    ctx.response.status = 200;
    ctx.response.body = res;
};

exports.checkNote = async (ctx) => {
    let body = ctx.request.body;

    let flag = true;

    let query = {userid: body.userid, articid: body.articid};
    let userNote = await mongodb.find(db_name, coll_userNote, query, null);
    if (userNote.length) {
        userNote = userNote[0];
        let notes = userNote.notes;
        for (let note of notes) {
            if (parseInt(body.start) >= parseInt(note.start) && parseInt(body.start) < parseInt(note.end)
                || parseInt(body.end) >= parseInt(note.start) && parseInt(body.end) < parseInt(note.end)) {
                flag = false;
                break;
            }
            if (parseInt(body.start) <= parseInt(note.start) && parseInt(body.end) >= parseInt(note.end)
                || parseInt(body.start) >= parseInt(note.start) && parseInt(body.end) <= parseInt(note.end)) {
                flag = false;
                break;
            }
        }
    }
    ctx.response.status = 200;
    ctx.response.body = {flag: flag};
};

exports.saveNote = async (ctx) => {
    let body = ctx.request.body;
    if(body.end&&body.start&&body.content&&body.notecontent
       &&body.end!=''&&body.start!=''&&body.content!=''&&body.notecontent!='') {
        let userid = body.userid;
        let articid = body.articid;

        let query = {userid: userid, articid: articid};
        let userNote = await mongodb.find(db_name, coll_userNote, query, null);

        let createtime = moment().format('YYYY-MM-DD hh:mm:ss');
        let note = {
            end: body.end,
            start: body.start,
            content: body.content,
            notecontent: body.notecontent,
            createtime: createtime
        };
        if (userNote.length) {
            await mongodb.updateUser(db_name,coll_userNote,query,{$addToSet:{notes:note}});
        }else {
            let id = uuid.v4();
            let insert = {
                id:id,
                artictitle:body.artictitle,
                articimage:body.articimage,
                articurl:body.articurl,
                userid:userid,
                articid:articid,
                notes:[note]
            };
            await mongodb.insert(db_name,coll_userNote,insert);
        }
    }
    ctx.response.status = 200;
};

exports.modifyNote = async(ctx) => {
    let id = ctx.request.body.noteID;
    let content = ctx.request.body.content;
    let notecontent = ctx.request.body.notecontent;
    if(id&&id.trim()!=''&&content&&content.trim()!=''&&notecontent&&notecontent.trim()!=''){
        let note = await mongodb.find(db_name,coll_userNote,{id:id},null);
        if(note.length){
            let createtime = moment().format('YYYY-MM-DD hh:mm:ss');
            await mongodb.updateUser(db_name,coll_userNote,{'notes.content':content},{$set:{'notes.$.notecontent':notecontent,'notes.$.createtime':createtime}});
        }
    }
    ctx.response.status = 200;
};