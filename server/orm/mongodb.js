const client = require('mongodb').MongoClient;
const config = require('./../config/orm.conf');

module.exports = {
    getWebSitesInfo: async(userid) => {
        let db;
        try {
            db = await client.connect(config.mongodb_path + 'xz_sys');
            const coll = db.collection('UserSite');
            let sites = await coll.find({userid: userid}).toArray();
            if (sites.length > 0) {
                if (sites[0].sites.length > 0) {
                    return sites[0].sites;
                }
            }
            return false;
        } catch (error) {
            console.log(error);
        } finally {
            if (db != undefined) {
                db.close();
            }
        }
    },

    getUserTopics: async(query) => {
        let db;
        try {
            db = await client.connect(config.mongodb_path + 'xz_sys');
            const coll = db.collection('user');

            let topics = await coll.find(query).toArray();
            if (topics.length > 0) {
                return topics;
            }
            return false;

        } catch (error) {
            console.log(error);
        } finally {
            if (db != undefined) {
                db.close();
            }
        }
    },
    getTopicsInfo: async(query) => {
        let db;
        try {
            db = await client.connect(config.mongodb_path + 'xz_sys');
            const coll = db.collection('topic_template');

            let topics = await coll.find(query).toArray();
            if (topics.length > 0) {
                return topics;
            }
            return false;

        } catch (error) {
            console.log(error);
        } finally {
            if (db != undefined) {
                db.close();
            }
        }
    },

    getRecommend: async() => {
        let db;
        try {
            db = await client.connect(config.mongodb_path + 'xz_sys');
            const coll = db.collection('recommend');
            let recommends = await coll.find().sort({date: -1}).toArray();
            return recommends[0];
        } catch (error) {
            console.log(error);
        } finally {
            if (db != undefined) {
                db.close();
            }
        }
    },

    find: async(db_name, coll_name, query, page) => {
        let db;
        try {
            db = await client.connect(config.mongodb_path + db_name);
            const coll = db.collection(coll_name);
            let dataArray = null;
            if (page == null) {
                if (query instanceof Array) {
                    dataArray = await coll.find(query[0], query[1]).toArray();
                } else {
                    dataArray = await coll.find(query).toArray();
                }
            } else {
                if (query instanceof Array) {
                    dataArray = await coll.find(query[0], query[1]).limit(20).skip(page).toArray();
                } else {
                    dataArray = await coll.find(query).limit(20).skip(page).toArray();
                }
            }
            return dataArray;

        } catch (err) {
            console.log(err);

        } finally {
            if (db != undefined) {
                db.close();
            }
        }
    },
    getCount: async(db_name, coll_name, query) => {
        let db;
        try {
            db = await client.connect(config.mongodb_path + db_name);
            const coll = db.collection(coll_name);
            let count = await coll.find(query).count();

            return count;

        } catch (err) {
            console.log(err);

        } finally {
            if (db != undefined) {
                db.close();
            }
        }
    },
    updateUser: async(db_name, coll_name, filer, update) => {
        let db;
        try {
            db = await client.connect(config.mongodb_path + db_name);
            const coll = db.collection(coll_name);
            return await coll.updateOne(filer, update);
        } catch (err) {
            console.log(err);

        } finally {
            if (db != undefined) {
                db.close();
            }
        }
    },
    insert: async(db_name, coll_name, insert) => {
        let db;
        try {
            db = await client.connect(config.mongodb_path + db_name);
            const coll = db.collection(coll_name);
            await coll.insertOne(insert);
        } catch (err) {
            console.log(err);
        } finally {
            if (db != undefined) {
                db.close();
            }
        }
    },
    replace: async(db_name, coll_name, filter, doc) => {
        let db;
        try {
            db = await client.connect(config.mongodb_path + db_name);
            const coll = db.collection(coll_name);
            await coll.replaceOne(filter, doc);
        } catch (err) {
            console.log(err);
        } finally {
            if (db != undefined) {
                db.close();
            }
        }
    },

    update: async(db_name, coll_name, filer, update) => {
        let db;
        try {
            db = await client.connect(config.mongodb_path + db_name);
            const coll = db.collection(coll_name);
            return await coll.updateOne(filer, update);
        } catch (err) {
            console.log(err);

        } finally {
            if (db != undefined) {
                db.close();
            }
        }
    },

    getAllTemplate: async() => {
        let db;
        try {
            db = await client.connect(config.mongodb_path + 'xz_sys');
            const coll = db.collection('topic_template');
            return await coll.find().toArray();
        } catch (err) {
            console.log(err);
        } finally {
            if (db != undefined) {
                db.close();
            }
        }
    },

    deleteNote: async(db_name, coll_name, query) => {
        let db;
        try {
            db = await client.connect(config.mongodb_path + db_name);
            const coll = db.collection(coll_name);
            return await coll.deleteOne(query);
        } catch (err) {
            console.log(err);
        } finally {
            if (db != undefined) {
                db.close();
            }
        }
    },

    getTopicEvents: async(db_name, coll_name, query) => {
        let db;
        try {
            db = await client.connect(config.mongodb_path + db_name);
            const coll = db.collection(coll_name);
            let dataArray = coll.find(query).sort({time:1}).toArray();
            return dataArray;
        } catch (err) {
            console.log(err);
        } finally {
            if(db!=undefined){
                db.close;
            }
        }
    },

    getKnowledgedbs: async(db_name, coll_name,query)=>{
        let db;
        try {
            db = await client.connect(config.mongodb_path + db_name);
            const coll = db.collection(coll_name);
            return await coll.find(query).toArray();
        } catch (err) {
            console.log(err);
        } finally {
            if(db != undefined){
                db.close;
            }
        }
    },
};