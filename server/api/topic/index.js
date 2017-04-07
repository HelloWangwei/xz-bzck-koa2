const router = require('koa-router')();
const topicController = require('./topic.controller');
const topicSubscriberController = require('./topic.subscriber.controller.js');

router.post('/getUserTopic',topicController.getUserTopic);//专题定制init
router.post('/getInfoByTopic',topicController.getInfoByTopic);//专题定制搜索

router.post('/getUserSubscriber',topicSubscriberController.getUserSubscriber);//专题订阅init
router.post('/getInfoBySubscriber',topicSubscriberController.getInfoBySubscriber);//专题订阅搜索

router.post('/getTopics',topicSubscriberController.getTopics);//个人中心_专题订阅init
router.post('/modifySubscriber',topicSubscriberController.modifySubscriber);//个人中心的订阅状态切换

router.post('/exportTopics',topicController.exportTopics);//专题订阅\定制导出

router.post('/timeLine',topicSubscriberController.timeLine);//时间轴

router.post('/serchTopicById',topicSubscriberController.serchTopicById);//专题订阅_专题树

router.post('/getKnowledgedbs',topicSubscriberController.getKnowledgedbs);//智库
module.exports = router;