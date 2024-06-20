#include <FastLED.h>
#include <Servo.h>
#include <OneWire.h>
#include <DallasTemperature.h>

#define ServoPin    8 // 먹이 공급 모터
#define SensorPin A2  // pH 미터 아날로그 출력을 아두이노 아날로그 입력 2에 연결
#define Offset 0.00   // 보정값
#define ArrayLenth  40 // 수집 횟수
#define ONE_WIRE_BUS 7

#define FAN 2         // 팬 핀 설정
#define LED_PIN     9 // LED 스트립 핀
#define NUM_LEDS    30 // LED 개수
#define BRIGHTNESS  64
#define LED_TYPE    WS2811
#define COLOR_ORDER GRB

int IN1 = 4; // 모터 컨트롤1 핀
int IN2 = 3; // 모터 컨트롤2 핀
int water_pin = A0; // 물 센서 핀


// 여과기 핀코드 6번

Servo servoMotor;
CRGB leds[NUM_LEDS];
OneWire ourWire(ONE_WIRE_BUS);
DallasTemperature sensors(&ourWire);


int feedCount = 0;              // 먹이를 줄 횟수
unsigned long feedInterval = 0; // 먹이를 줄 시간 간격 (밀리초 단위)
unsigned long lastFeedTime = 0; // 마지막으로 먹이를 준 시간
bool feedingInProgress = false; // 먹이 주기가 진행 중인지 여부
String inputString;

int pHArray[ArrayLenth];        // 센서 피드백의 평균값 저장
int pHArrayIndex = 0;

bool waterSupplying = false; // 물 공급 중 여부 플래그

void setup() {
  Serial.begin(9600);
  sensors.begin();
  servoMotor.attach(ServoPin);
  servoMotor.write(0);
  
  FastLED.addLeds<LED_TYPE, LED_PIN, COLOR_ORDER>(leds, NUM_LEDS).setCorrection(TypicalLEDStrip);
  FastLED.setBrightness(BRIGHTNESS);

  // 초기 LED 설정
  fill_solid(leds, NUM_LEDS, CRGB::Black);
  FastLED.show();

  pinMode(FAN, OUTPUT);   // 팬 핀을 출력으로 설정
  digitalWrite(FAN, LOW); // 초기 상태를 꺼짐으로 설정

  pinMode(6, OUTPUT);   // 릴레이 핀을 출력으로 설정
  digitalWrite(6, LOW); // 초기 상태를 꺼짐으로 설정

  pinMode(IN1,OUTPUT);  // 모터 컨트롤1 핀 
  pinMode(IN2,OUTPUT);  // 모터 컨트롤2 핀 
}

void loop() {
  feedSetting(); // 먹이 공급 세팅
  static unsigned long samplingTime = millis();
  static float pHValue = 0, voltage = 0, temperatureC = 0;

  // pH 센서 및 온도 센서 샘플링
  if (millis() - samplingTime > 5000) { // 샘플링 간격을 5초로 설정 (5000 밀리초)
    // pH 센서 샘플링
    pHArray[pHArrayIndex++] = analogRead(SensorPin);
    if (pHArrayIndex == ArrayLenth) pHArrayIndex = 0;
    voltage = avergearray(pHArray, ArrayLenth) * 5.0 / 1024.0;
    pHValue = 3.5 * voltage + Offset;

    // 온도 센서 샘플링
    sensors.requestTemperatures();
    temperatureC = sensors.getTempCByIndex(0);

    // pH 값 및 온도 값 출력
    Serial.print(pHValue, 2);
    Serial.print(",");
    Serial.println(temperatureC, 2);

    // 온도가 25도 이상일 때 팬을 켬
    if (temperatureC < 25) {
      digitalWrite(FAN, HIGH);
    } else {
      digitalWrite(FAN, LOW);
    }

    // 온도가 21도 이일 때 LED를 빨간색으로 설정
    if (temperatureC >= 21.0) {
      fill_solid(leds, NUM_LEDS, CRGB::Red);
    } else if (temperatureC < 27) {
      fill_solid(leds, NUM_LEDS, CRGB::Black);
    }


if (pHValue < 0) {
  // pH 농도가 6.5보다 작은 경우
  digitalWrite(6, HIGH); // 릴레이 켜기
} else if (pHValue <= 5 || pHValue >= 7) {
  // pH 농도가 7.5보다 큰 경우
  digitalWrite(6, LOW); // 릴레이 끄기
} 
  else if (pHValue < 7) {
  // pH 농도가 7.5보다 큰 경우
  digitalWrite(6, HIGH); // 릴레이 끄기
}
  else {
  // pH 농도가 6.5에서 7.5 사이인 경우
  // 다른 동작을 수행하거나 그냥 아무것도 하지 않습니다.
}


    FastLED.show();
    samplingTime = millis(); // 샘플링 시간 업데이트
  }

// 물 센서 값 읽기
  int val = analogRead(water_pin);
  Serial.println(val);
  
  // 물 센서 값에 따른 제어
  if (val <= 300) {
    StartA();
    waterSupplying = true; // 물 공급 중
  } else {
    if (waterSupplying) {
      StopA(); 
      waterSupplying = false; // 물 공급 종료
    }
  }
  
}

/*==============================================
  먹이 공급 설정
==============================================*/

void feedSetting() {
  if (Serial.available() > 0) {
    inputString = Serial.readStringUntil('\n');
    Serial.println(inputString);
    inputString.trim();                       // 문자열 앞뒤 공백 제거
    if (inputString.startsWith("FEED")) {
      feedingInProgress = false;              // 현재 진행 중인 먹이 주기 작업 중단
      processInput(inputString);
    }
  }
  
  if (feedingInProgress && millis() - lastFeedTime >= feedInterval) {
    lastFeedTime = millis();                  // 마지막 먹이 주기 시간 업데이트
    Serial.println(lastFeedTime);
    for(int i = 0; i < feedCount; i++) {
      feedFish();
    }
  }

  static unsigned long previousPrintTime = 0;
  if (feedingInProgress && millis() - previousPrintTime >= 1000) { // 매 1초마다
    previousPrintTime = millis();
    Serial.print("Elapsed Time: ");
    Serial.print(previousPrintTime / 1000);
    Serial.println(" seconds");
  }
}

void processInput(String input) {
  feedCount = getFeedCount(input);            // 먹이 공급 횟수 추출
  feedInterval = getTimeDelay(input) * 1000;  // 주어진 간격을 밀리초로 변환
  feedingInProgress = true;                   // 먹이 주기 시작
  lastFeedTime = millis() - feedInterval;     // 즉시 첫 번째 먹이 주기를 시작하기 위해 설정
}

void feedFish() {
  servoMotor.write(90);
  delay(1000);
  servoMotor.write(0);
  delay(1000);
}

int getFeedCount(String input) {
  String feedCountString = input.substring(input.indexOf(' ') + 1, input.indexOf('T') - 1);
  return feedCountString.toInt(); // 횟수 반환
}

long getTimeDelay(String input) {
  int timeIndex = input.indexOf("TIME") + 5;
  String timeString = input.substring(timeIndex);
  int colonIndex = timeString.indexOf(":");
  int hours = timeString.substring(0, colonIndex).toInt();
  int minutes = timeString.substring(colonIndex + 1).toInt();

  return (hours * 3600 + minutes * 60); // 지연 시간을 초 단위로 반환
}

double avergearray(int *arr, int number) {
  int i;
  int max, min;
  double avg;
  long amount = 0;
  if (number <= 0) {
    return 0;
  }
  if (number < 5) {   // 5보다 작으면 직접 계산
    for (i = 0; i < number; i++) {
      amount += arr[i];
    }
    avg = amount / number;
    return avg;
  } else {
    if (arr[0] < arr[1]) {
      min = arr[0];
      max = arr[1];
    } else {
      min = arr[1];
      max = arr[0];
    }
    for (i = 2; i < number; i++) {
      if (arr[i] < min) {
        amount += min;        // arr < min
        min = arr[i];
      } else {
        if (arr[i] > max) {
          amount += max;    // arr > max
          max = arr[i];
        } else {
          amount += arr[i]; // min <= arr <= max
        }
      }
    }
    avg = (double)amount / (number - 2);
  }
  return avg;
}


void StartA() {
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
}

// 모터A 정지
void StopA() {
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, LOW);
}