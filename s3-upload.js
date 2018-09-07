/**
 * Upload folder to aws s3 bucket with preset mime/type and skip files with same hash
 * > node upload.js --bucket BACKET_NAME [--root <source folder, default: ./dist> --exclude <minimach mask>;<minimach mask>...]
 * 
 * Check AWS credentials before:
 *   ~/.aws/credentials
 *   C:\Users\USERNAME\.aws\credentials
 * 
 *   aws_access_key_id = "you_access_key"
 *   aws_secret_access_key = "you_secret_key"
 */
// jshint esversion: 6
const 
    aws = require('aws-sdk'),
    s3 = new aws.S3(),
    path = require('path'),
    fs = require('fs'),
    minimatch = require("minimatch");
    mime = require('mime'),
    crypto = require('crypto');

let BUCKET = '',
    ROOT = './dist',
    EXCLUDE = '',
    VERBOSE,
    args = process.argv;

BUCKET  = args[(args.indexOf('--bucket' )+1)||-1] || BUCKET;
ROOT    = args[(args.indexOf('--root'   )+1)||-1] || ROOT;
EXCLUDE = args[(args.indexOf('--exclude')+1)||-1] || EXCLUDE;
VERBOSE = (args.indexOf('--verbose')>=0);
if (!BUCKET || !ROOT) {
    console.error(`Wrong params params \n    BUCKET=${BUCKET}\n    ROOT=${ROOT}`);
    return;
}


let startTime = new Date();
console.log(`Upload ${ROOT} to s3:[${BUCKET}]`);

console.log('Download file list...');

// prepare bucket list
listBucket((err,list) => {
    console.log(`founed ${list.length} files`);

    // convert to accociate array
    list = list.reduce((acc, cur) => {
        acc[cur.Key] = cur;
        return acc;
    }, {});

    upload(list)
    .then(_=>{
        console.log(`Upload success, time ${(new Date() - startTime)/1000} sec`);
        calcBacketSite(BUCKET, url=>console.log('Endpoint:', url));
    })
    .catch(console.error);

});


// list - hash list = { 'path':  { LastModified: 2018-06-07T12:42:31.000Z, ETag: '"2df798d9f11a2726c2f6c9a1933db5a9"', Size: 17376 }, ...}
function upload(list) {
    
    let tread = new Promise(resolve=>resolve());
    
    walkSync(ROOT).forEach(file => {
        tread = tread.then(_ => new Promise((resolve, reject) => {
            let Key = path.relative(ROOT, file).replace(/\\/g,'/');

            
            if (EXCLUDE && EXCLUDE.split(';').reduce((acc,mask)=> acc || minimatch(Key, mask, {matchBase:true, dot: true}), false) // split mask by ;
            ){
                resolve();
                return;
            }

            fs.readFile(file, {}, (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }

                let obj = list[Key];
                if (obj && obj.ETag && (obj.ETag.replace(/[\"\']/g,'')==crypto.createHash('md5').update(data).digest("hex"))) { // compare hashes
                    if (VERBOSE)
                        console.log(`upload file ${Key}...`, 'skip (hash is same)');
                    resolve();
                    return;
                }
                
                process.stdout.write(`upload file ${Key}...`);

                // upload
                s3.putObject({
                        Bucket: BUCKET,
                        Key: Key,
                        Body: data,
                        ContentType: mime.getType(file)
                    },
                    (err, data) => {
                        if (err) {
                            console.log('Fail!');
                            reject(err);
                            return;
                        }
                        console.log('ok!');
                        resolve();
                    }
                );
            });
        }));
        
    });
    
    return tread;

}

// walk for dir
function walkSync(dir) {
    let results = [];

    fs.readdirSync(dir).forEach(file => {
        if (!file) return;
        file = dir + '/' + file;

        let stat = fs.statSync(file);
        if (stat && stat.isDirectory()) 
            results = results.concat( walkSync(file) );
        else 
            results.push(file);
    });

    return results;
}


// read bucket list
// list - hash list = { 'path':  { LastModified: 2018-06-07T12:42:31.000Z, ETag: '"2df798d9f11a2726c2f6c9a1933db5a9"', Size: 17376 }, ...}
function listBucket(cb_err_list, NextContinuationToken) {

    s3.listObjectsV2({
            Bucket: BUCKET,
            // MaxKeys:100,
            ContinuationToken: NextContinuationToken
        }, 
        (err, data) => {
            if (err) {
                console.error(err, err.stack); // an error occurred
                cb_err_list(err);
                return;
            }

            if (!data.NextContinuationToken) {
                cb_err_list(0, data.Contents);
                return;
            }

            listBucket((err, list) => {
                if (err) {
                    cb_err_list(err);
                    return;
                }

                cb_err_list(0, data.Contents.concat(list));

            }, data.NextContinuationToken);
        }
    );
}

// ${bucket}.s3-website-<region>.amazonaws.com
function calcBacketSite(BUCKET, callback_url) {
    s3.getBucketLocation({ Bucket: BUCKET }, (err, data)=>{
        if (err) {
            callback_url();
            return;
        }

        let region = (data.LocationConstraint || 'us-east-1');
        callback_url(`http://${BUCKET}.s3-website-${region}.amazonaws.com`);
    });
}
