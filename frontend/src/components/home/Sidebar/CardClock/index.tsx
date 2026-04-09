/**
 * 天气时钟组件
 * 参考 anheyu-app CardClock.vue 实现
 * 显示实时时钟、日期、天气信息
 */
"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import styles from "./CardClock.module.css";

// ─── 类型定义 ─────────────────────────────────────────────────

interface WeatherConfig {
  qweatherKey: string;
  qweatherAPIHost: string;
  ipAPIKey: string;
  loading: string;
  defaultRectangle: boolean;
  rectangle: string;
}

interface WeatherNow {
  icon: string;
  text: string;
  temp: string;
  windDir: string;
  wind360: string;
}

interface CardClockProps {
  config: WeatherConfig;
}

// ─── 天气图标 Unicode 映射 ────────────────────────────────────
// QWeather icon font 的 unicode 码点映射，避免大量 CSS 类定义

const WEATHER_ICON_UNICODE: Record<string, string> = {
  "100": "\uf101",
  "101": "\uf102",
  "102": "\uf103",
  "103": "\uf104",
  "104": "\uf105",
  "150": "\uf106",
  "151": "\uf107",
  "152": "\uf108",
  "153": "\uf109",
  "300": "\uf10a",
  "301": "\uf10b",
  "302": "\uf10c",
  "303": "\uf10d",
  "304": "\uf10e",
  "305": "\uf10f",
  "306": "\uf110",
  "307": "\uf111",
  "308": "\uf112",
  "309": "\uf113",
  "310": "\uf114",
  "311": "\uf115",
  "312": "\uf116",
  "313": "\uf117",
  "314": "\uf118",
  "315": "\uf119",
  "316": "\uf11a",
  "317": "\uf11b",
  "318": "\uf11c",
  "350": "\uf11d",
  "351": "\uf11e",
  "399": "\uf11f",
  "400": "\uf120",
  "401": "\uf121",
  "402": "\uf122",
  "403": "\uf123",
  "404": "\uf124",
  "405": "\uf125",
  "406": "\uf126",
  "407": "\uf127",
  "408": "\uf128",
  "409": "\uf129",
  "410": "\uf12a",
  "456": "\uf12b",
  "457": "\uf12c",
  "499": "\uf12d",
  "500": "\uf12e",
  "501": "\uf12f",
  "502": "\uf130",
  "503": "\uf131",
  "504": "\uf132",
  "507": "\uf133",
  "508": "\uf134",
  "509": "\uf135",
  "510": "\uf136",
  "511": "\uf137",
  "512": "\uf138",
  "513": "\uf139",
  "514": "\uf13a",
  "515": "\uf13b",
  "800": "\uf13c",
  "801": "\uf13d",
  "802": "\uf13e",
  "803": "\uf13f",
  "804": "\uf140",
  "805": "\uf141",
  "806": "\uf142",
  "807": "\uf143",
  "900": "\uf144",
  "901": "\uf145",
  "999": "\uf146",
};

// 风向图标
const WIND_ICON_UNICODE = "\uf18e";

// ─── 天气图标颜色映射 ────────────────────────────────────────

const WEATHER_COLOR_MAP: Record<string, string> = {
  "100": "#fdcc45", // 晴
  "101": "#fe6976",
  "102": "#fe7f5b",
  "103": "#fe7f5b",
  "104": "#2152d1", // 阴
  "150": "#2152d1",
  "151": "#2152d1",
  "152": "#2152d1",
  "153": "#2152d1",
  "154": "#2152d1",
  "300": "#49b1f5",
  "301": "#49b1f5",
  "302": "#fdcc46",
  "303": "#fdcc46",
  "304": "#fdcc46",
  "305": "#49b1f5",
  "306": "#49b1f5",
  "307": "#49b1f5",
  "308": "#49b1f5",
  "309": "#49b1f5",
  "310": "#49b1f5",
  "311": "#49b1f5",
  "312": "#49b1f5",
  "313": "#49b1f5",
  "314": "#49b1f5",
  "315": "#49b1f5",
  "316": "#49b1f5",
  "317": "#49b1f5",
  "318": "#49b1f5",
  "350": "#49b1f5",
  "351": "#49b1f5",
  "399": "#49b1f5",
  "400": "#a3c2dc",
  "401": "#a3c2dc",
  "402": "#a3c2dc",
  "403": "#a3c2dc",
  "404": "#a3c2dc",
  "405": "#a3c2dc",
  "406": "#a3c2dc",
  "407": "#a3c2dc",
  "408": "#a3c2dc",
  "409": "#a3c2dc",
  "410": "#a3c2dc",
  "456": "#a3c2dc",
  "457": "#a3c2dc",
  "499": "#a3c2dc",
  "500": "#97acba",
  "501": "#97acba",
  "502": "#97acba",
  "503": "#97acba",
  "504": "#97acba",
  "507": "#97acba",
  "508": "#97acba",
  "509": "#97acba",
  "510": "#97acba",
  "511": "#97acba",
  "512": "#97acba",
  "513": "#97acba",
  "514": "#97acba",
  "515": "#97acba",
  "800": "#2152d1",
  "801": "#2152d1",
  "802": "#2152d1",
  "803": "#2152d1",
  "804": "#2152d1",
  "805": "#2152d1",
  "806": "#2152d1",
  "807": "#2152d1",
  "900": "red",
  "999": "red",
  "901": "#179fff",
};

// ─── 工具函数 ────────────────────────────────────────────────

const zeroPadding = (num: number, digit: number): string => String(num).padStart(digit, "0");

const WEEK_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function formatTime(date: Date) {
  return `${zeroPadding(date.getHours(), 2)}:${zeroPadding(date.getMinutes(), 2)}:${zeroPadding(date.getSeconds(), 2)}`;
}

function formatDate(date: Date) {
  return `${zeroPadding(date.getFullYear(), 4)}-${zeroPadding(date.getMonth() + 1, 2)}-${zeroPadding(date.getDate(), 2)} ${WEEK_NAMES[date.getDay()]}`;
}

function getPeriod(date: Date) {
  return date.getHours() >= 12 ? " P M" : " A M";
}

// ─── 组件 ────────────────────────────────────────────────────

export const CardClock = memo(function CardClock({ config }: CardClockProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [currentPeriod, setCurrentPeriod] = useState("");
  const [weatherNow, setWeatherNow] = useState<WeatherNow | null>(null);
  const [weatherColor, setWeatherColor] = useState("#000");
  const [cityName, setCityName] = useState("定位中...");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 更新时间
  const updateTime = useCallback(() => {
    const now = new Date();
    setCurrentTime(formatTime(now));
    setCurrentDate(formatDate(now));
    setCurrentPeriod(getPeriod(now));
  }, []);

  // 根据经纬度获取城市名称
  const fetchCityName = useCallback(
    async (location: string): Promise<string> => {
      try {
        const res = await fetch(
          `https://geoapi.qweather.com/v2/city/lookup?location=${location}&key=${config.qweatherKey}`
        );
        const data = await res.json();
        if (data.code === "200" && data.location?.length > 0) {
          return data.location[0].name || "未知";
        }
        return "未知";
      } catch {
        return "未知";
      }
    },
    [config.qweatherKey]
  );

  // 获取天气信息
  const fetchWeather = useCallback(
    async (location: string) => {
      try {
        const res = await fetch(
          `https://${config.qweatherAPIHost}/v7/weather/now?location=${location}&key=${config.qweatherKey}`
        );
        const data = await res.json();
        if (data.code === "200" && data.now) {
          setWeatherNow(data.now);
          setWeatherColor(WEATHER_COLOR_MAP[data.now.icon] || "#000");
        }
      } catch {
        // 静默失败
      } finally {
        setIsLoading(false);
      }
    },
    [config.qweatherAPIHost, config.qweatherKey]
  );

  // 获取 IP 定位并加载天气
  const initWeather = useCallback(async () => {
    if (config.defaultRectangle) {
      // 使用固定坐标
      const location = config.rectangle;
      const city = await fetchCityName(location);
      setCityName(city);
      await fetchWeather(location);
    } else {
      // 通过后端 API 获取 IP 定位
      try {
        const res = await fetch("/api/public/weather/ip-location");
        const result = await res.json();

        let location = config.rectangle;
        let city = "未知";

        if (result.code === 200 && result.data) {
          // 优先 city，空时用 province/country（如局域网、境外）再兜底「未知」
          city =
            result.data.city ||
            result.data.province ||
            result.data.country ||
            "未知";
          if (result.data.longitude && result.data.latitude) {
            location = `${result.data.longitude},${result.data.latitude}`;
          } else if (result.default_rectangle) {
            // 局域网或无经纬度时后端会带 default_rectangle，优先用其请求天气
            location = result.default_rectangle;
          }
        } else {
          city = await fetchCityName(location);
        }

        setCityName(city);
        await fetchWeather(location);
      } catch {
        // IP 定位失败，使用默认坐标
        const location = config.rectangle;
        const city = await fetchCityName(location);
        setCityName(city);
        await fetchWeather(location);
      }
    }
  }, [config.defaultRectangle, config.rectangle, fetchCityName, fetchWeather]);

  // 初始化
  useEffect(() => {
    updateTime();
    timerRef.current = setInterval(updateTime, 1000);
    initWeather();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [updateTime, initWeather]);

  return (
    <div className={styles.cardClock}>
      {isLoading ? (
        <div className={styles.loadingContainer}>
          {config.loading ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.loading} alt="Loading" className={styles.loadingImg} />
          ) : (
            <span className={styles.location}>加载中...</span>
          )}
        </div>
      ) : (
        <div className={styles.cardBackground}>
          <div className={styles.clockContent}>
            <div className={styles.clockInner}>
              {/* 第一行：日期 + 天气 */}
              <div className={styles.clockRow}>
                <span className={styles.clockDate}>{currentDate}</span>
                {weatherNow && (
                  <span className={styles.weather}>
                    <span className={styles.weatherIcon} style={{ color: weatherColor }}>
                      {WEATHER_ICON_UNICODE[weatherNow.icon] || ""}
                    </span>{" "}
                    {weatherNow.text} <span className={styles.temp}>{weatherNow.temp}</span> ℃
                  </span>
                )}
              </div>

              {/* 第二行：时间 */}
              <div className={styles.clockRow}>
                <span className={styles.clockTime}>{currentTime}</span>
              </div>

              {/* 第三行：风向 + 城市 + AM/PM */}
              <div className={styles.clockRow}>
                {weatherNow && (
                  <span className={styles.windDir}>
                    <span className={styles.windIcon} style={{ transform: `rotate(${weatherNow.wind360}deg)` }}>
                      {WIND_ICON_UNICODE}
                    </span>{" "}
                    {weatherNow.windDir}
                  </span>
                )}
                <span className={styles.location}>{cityName}</span>
                <span className={styles.period}>{currentPeriod}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

CardClock.displayName = "CardClock";

export default CardClock;
