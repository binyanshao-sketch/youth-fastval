ALTER TABLE `lottery_records` ADD COLUMN `poster_url` VARCHAR(255) DEFAULT NULL COMMENT '存贮于七牛云的海报URL';
ALTER TABLE `lucky_bag_records` ADD COLUMN `poster_url` VARCHAR(255) DEFAULT NULL COMMENT '存贮于七牛云的海报URL';
