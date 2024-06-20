const Sequelize = require("sequelize");
const fs = require("fs");
const path = require("path");
const env = process.env.NODE_ENV || "development";
const config = require("../config/config")[env];

const db = {};
const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  config
);

db.sequelize = sequelize;

const basename = path.basename(__filename);
fs.readdirSync(__dirname) // 현재 폴더의 모든 파일을 조회
  .filter((file) => {
    // filter은 조건에 맞는 것만 필터
    // 숨김 파일, index.js, js 확장자가 아닌 파일 필터링
    return (
      file.indexOf(".") !== 0 && file !== basename && file.slice(-3) === ".js"
    );
  })
  .forEach((file) => {
    // 해당 파일의 모델 불러와서 init ( hashtag.js, post.js, user.js를 불러온다 )
    const model = require(path.join(__dirname, file));
    console.log(file, model.name);
    db[model.name] = model; // DB는 객체이다. []쓴다고 배열이라고 생각하면 안됨!
    model.initiate(sequelize); // 각 models initiate 초기화
  });

Object.keys(db).forEach((modelName) => {
  // associate 호출
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

module.exports = db;
