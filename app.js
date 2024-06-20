const express = require("express");
const { SerialPort, ReadlineParser} = require("serialport");
const nunjucks = require("nunjucks");
const dotenv = require("dotenv");
const path = require("path");
const morgan = require("morgan");
const { sequelize, IotSensors, FeedSetting } = require("./models");
const TelegramBot = require('node-telegram-bot-api');
const { WaterSupplyLogs } = require("./models");


const app = express();

const MainRouter = require("./routes/main");
const feedRouter = require("./routes/feed");
const tempRouter = require("./routes/temp");
const phRouter = require("./routes/ph")
const waterRouter = require("./routes/water");

dotenv.config();

/*==============================================
 파일 액세스 허용
==============================================*/
app.set("port", process.env.PORT || 3000);
app.set("view engine", "html"); // 넉적슨 임포팅 부분
nunjucks.configure("views", {
  express: app,
  watch: true,
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "/views/main.html"));
});


app.get("/water.html", (req, res) => {
  res.sendFile(path.join(__dirname, "/views/water.html"));
});


/*==============================================
 아두이노 시리얼 포트 설정
==============================================*/
//const arduinoCOMPort = "/dev/ttyUSB0";
const arduinoCOMPort = "COM5";
const com1 = new SerialPort({
  path: arduinoCOMPort,
  baudRate: 9600,
  dataBits: 8,
  parity: "none",
  stopBits: 1,
  flowControl: false,
});

const parser = new ReadlineParser();
com1.pipe(parser);

com1.on("open", function () {
  console.log("open serial communication");
  console.log("http://localhost:3000/");
});

parser.on("data", async function (data) {
  const dataString = data.toString().trim();

  try {
    if (dataString.length === 0) {
      console.log("유효하지 않은 데이터입니다: 데이터가 비어 있습니다.");
      return;
    }

    const parsedValues = dataString.split('.').map(val => parseInt(val));
    const isValidData = parsedValues.every(val => !isNaN(val));

    if (isValidData) {
      const quantity = parsedValues[0];
      const now = new Date();
      const date = now.toISOString().split('T')[0];
      const time = now.toTimeString().split(' ')[0];

      if (quantity < 45) {
        return;
      }

      console.log("시리얼 데이터 수신:", dataString);
      console.log("분석된 데이터:", { date, time, quantity });

      let waterSupplyCount = quantity <= 300 ? 'O' : 'X';

      if (waterSupplyCount === 'O') {
        const newLog = await WaterSupplyLogs.create({ date, time, quantity });
        console.log("새로운 물 공급 로그 저장됨:", newLog);
      }

      const dataStringToSend = `WATER_SUPPLY ${waterSupplyCount} TIME ${time}\n`;
      com1.write(dataStringToSend, async function (err) {
        if (err) {
          console.error("시리얼 데이터 전송 오류:", err.message);
        } else {
          console.log("물 공급 및 시간 정보 전송 완료:", dataStringToSend);
        }
      });
    } else {
      console.log("유효하지 않은 데이터입니다:", dataString);
    }
  } catch (error) {
    console.error("물 공급 및 로그 저장 중 오류:", error);
  }
});

/*==============================================
 시퀄라이즈 DB 설정
==============================================*/
sequelize
  .sync({ force: false })
  .then(() => {
    console.log("데이터베이스 연결 성공");
  })
  .catch((err) => {
    console.error(err);
  });

app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "css")));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/*==============================================
 아두이노 FEED 먹이 전송
==============================================*/
app.post("/feed", async (req, res) => {
  const { feedCount, hour, minute } = req.body;
  const dataString = `FEED ${feedCount} TIME ${hour}:${minute}\n`;

  com1.write(dataString, async function (err) {
    if (err) {
      return console.log("Error on write: ", err.message);
    }
    console.log("Message sent complete");
    console.log(dataString);

    try {
      const newSetting = await FeedSetting.create({
        feed_count: feedCount,
        hour: hour,
        minute: minute,
      });
      console.log("새로운 설정값이 저장되었습니다:", newSetting);
      res.status(200).send("설정값이 성공적으로 저장되었습니다.");
    } catch (error) {
      console.error("설정값 저장 중 에러 발생:", error);
      res.status(500).send("설정값을 저장하는 도중 에러가 발생했습니다.");
    }
  });
});

/*==============================================
 아두이노 데이터 수신 및 저장
==============================================*/
// 딜레이 함수 정의
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

com1.on("data", async function (data) {
  try {
    await delay(2000); // 2초(2000밀리초) 딜레이

    const dataArray = data.toString().split(','); // 데이터를 ','로 분리하여 배열에 저장
    if (dataArray.length === 2) { // 데이터가 두 개의 요소로 이루어져 있는지 확인
      const phValue = parseFloat(dataArray[0]); // 첫 번째 요소를 pH 값으로 파싱
      const tempValue = parseFloat(dataArray[1]); // 두 번째 요소를 온도 값으로 파싱
      
      if (!isNaN(phValue) && !isNaN(tempValue)) { // pH 값과 온도 값이 모두 유효한지 확인
        // 데이터베이스에 저장
        const newSensorData = await IotSensors.create({ ph: phValue, temp: tempValue });
        console.log("pH와 온도 데이터가 데이터베이스에 저장되었습니다:", phValue, tempValue);
      } else {
        console.log("유효하지 않은 pH 또는 온도 값입니다.");
      }
    } else {
      console.log("올바르지 않은 데이터 형식입니다.");
    }
  } catch (error) {
    console.error("데이터 저장 중 에러 발생:", error);
  }
});

/*==============================================
 데이터베이스 저장된 온도데이터 조회 후 전송
==============================================*/
app.get('/temperature', async (req, res) => {
  try {
    // 데이터베이스에서 최근 30개의 온도 데이터 조회
    const recentTemperatures = await IotSensors.findAll({
      order: [['created_at', 'DESC']],
      limit: 30
    });

    if (recentTemperatures.length > 0) {
      // 조회된 데이터가 있다면 클라이언트로 응답
      const formattedTemperatures = recentTemperatures.map(data => ({
        temp: data.temp,
        time: data.created_at // 시간 데이터를 생성된 시간으로 설정
      }));
      res.json(formattedTemperatures);
    } else {
      // 조회된 데이터가 없다면 404 Not Found 응답
      res.status(404).json({ error: '온도 데이터가 없습니다.' });
    }
  } catch (error) {
    console.error('온도 데이터 조회 중 오류 발생:', error);
    // 오류 발생 시 500 Internal Server Error 응답
    res.status(500).json({ error: '서버 오류로 온도 데이터를 조회할 수 없습니다.' });
  }
});

/*==============================================
 데이터베이스 저장된 pH 조회 후 전송
==============================================*/
app.get('/phsensor', async (req, res) => {
  try {
    const recentpHValues = await IotSensors.findAll({
      order: [['created_at', 'DESC']],
      limit: 30
    });

    if (recentpHValues.length > 0) {
      const formattedpHValues = recentpHValues.map(data => ({
        ph: data.ph,
        time: data.created_at
      }));
      res.json(formattedpHValues);
    } else {
      res.status(404).json({ error: 'pH 데이터가 없습니다.' });
    }
  } catch (error) {
    console.error('pH 데이터 조회 중 오류 발생:', error);
    res.status(500).json({ error: '서버 오류로 pH 데이터를 조회할 수 없습니다.' });
  }
});

app.post("/water-supply", async (req, res) => {
  const { date, time, quantity } = req.body;

  try {
    const newLog = await WaterSupplyLogs.create({
      date: date,
      time: time,
      quantity: quantity,
    });

    console.log("새로운 물 공급 로그 저장됨:", newLog);
    res.status(200).send("물 공급 로그가 성공적으로 저장되었습니다.");
  } catch (error) {
    console.error("물 공급 로그 저장 중 오류:", error);
    res.status(500).send("물 공급 로그를 저장하는 도중 오류가 발생했습니다.");
  }
});

app.get("/water-supply-logs", async (req, res) => {
  try {
    const logs = await WaterSupplyLogs.findAll({
      limit: 10,
      order: [['createdAt', 'DESC']],
    });
    res.json(logs);
  } catch (error) {
    console.error("물 공급 로그 가져오기 오류:", error);
    res.status(500).send("물 공급 로그 가져오기 오류 발생.");
  }
});

/*==============================================
 Html 라우팅
==============================================*/
app.use("/main", MainRouter);
app.use("/feed", feedRouter);
app.use("/temp", tempRouter);
app.use("/ph", phRouter);
app.use("/water", waterRouter);

app.use((req, res, next) => {
  const error = new Error(`${req.method} ${req.url} 라우터가 없습니다.`);
  error.status = 404;
  next(error);
});

app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = process.env.NODE_ENV !== "production" ? err : {};
  res.status(err.status || 500);
  res.render("error");
});

app.get("/feed/:id", function (req, res) {
  console.log(req.params.id);
  com1.write(req.params.id);
  res.status(200).send("FEED Controll OK!!");
});
app.get("/temp/:id", function (req, res) {
  console.log(req.params.id);
  com1.write(req.params.id);
  res.status(200).send("temp Controll OK!!");
});
app.get("/ph/:id", function (req, res) {
  console.log(req.params.id);
  com1.write(req.params.id);
  res.status(200).send("ph Controll OK!!");
});
app.get("/water/:id", function (req, res) {
  console.log(req.params.id);
  com1.write(req.params.id);
  res.status(200).send("Water Control OK!!");
});
app.listen(app.get("port"), () => {
  console.log(app.get("port"), "번 포트에서 대기 중");
});

// Telegram Bot 설정
const botToken = '7384924467:AAEjtSGT2u_tJurCKHtMHfI4NsCD5U4r4PA'; // 본인의 텔레그램 봇 토큰을 넣으세요.
const bot = new TelegramBot(botToken, { polling: true });

// 주기적으로 데이터 요청하여 텔레그램으로 전송
setInterval(async () => {
  try {
    // 데이터베이스에서 최신 데이터 가져오기
    const latestData = await IotSensors.findOne({ order: [["created_at", "DESC"]], attributes: ['id', 'ph', 'temp', 'created_at'] });

    if (latestData) { // 최신 데이터가 존재할 때만 메시지 전송
      // 전송할 메시지 생성
      const message = `Latest Data:\nID: ${latestData.id}\npH: ${latestData.ph}\nTemperature: ${latestData.temp}°C\nCreated At: ${latestData.created_at}`;

      // 전송할 채팅 ID
      const chatId = '6384085264'; // 수신자의 채팅 ID를 넣으세요.

      // 메시지 전송
      bot.sendMessage(chatId, message);
      console.log("Latest Data:", latestData);
    } else {
      console.log("No data found in the database.");
    }
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}, 60000); // 1분마다 실행
