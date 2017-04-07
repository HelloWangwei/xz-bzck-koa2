module.exports = {
    mongodb_path: 'mongodb://192.168.1.205:27017/',
    neo4j_path: 'bolt://114.113.17.51:7687',
    elastic_hosts: [
        {
            host: '192.168.1.205', port: 9200
        },
        // {
        //     host: '114.113.17.52', port: 9200
        // }
        // ,
        // {
        //     host: '114.113.17.53', port: 9200
        // }
        // ,
        // {
        //     host: '114.113.17.54', port: 9200
        // }
    ],
    es_index: 'info',
    es_type: 'info'
};
