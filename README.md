# s3-upload
Upload folder to aws s3 bucket with preset mime/type and skip files with same hash  

# Run
     node upload.js --bucket BACKET_NAME [--root <source folder, default: ./dist> --exclude <minimach mask>]
 
# Check AWS credentials before

Edit files *~/.aws/credentials* or *C:\Users\USERNAME\.aws\credentials*

    aws_access_key_id = "you_access_key"
    aws_secret_access_key = "you_secret_key"
