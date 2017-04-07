const router = require('koa-router')();
const userController = require('./user.controller');

router.post('/findUser', userController.findUser);
router.post('/updateUser',userController.updateUser);
router.post('/userInfo',userController.userInfo);
router.post('/gerUserCollection',userController.getUserCollection);
router.post('/getUserSite',userController.getUserSite);
router.post('/getUserApply',userController.getUserApply);
router.post('/addUserApply',userController.addUserApply);
router.post('/getNotes',userController.getNotes);
router.post('/deleteNote',userController.deleteNote);
router.post('/setting/getTopic',userController.getTopic);
router.post('/setting/modifyTopic',userController.modifyTopic);
router.post('/setting/deleteTopic',userController.deleteTopic);
router.post('/frozenUser',userController.frozenUser);
module.exports = router;