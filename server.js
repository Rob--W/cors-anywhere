var express = require('express');
var app = express();
const fs = require('fs');
const request = require('request');
const cors = require('cors');

app.use(express.json());
app.use(cors());

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*")
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested, Content-Type, Accept Authorization"
    )
    if (req.method === "OPTIONS") {
      res.header(
        "Access-Control-Allow-Methods",
        "POST, PUT, PATCH, GET, DELETE"
      )
      return res.status(200).json({})
    }
    next()
  })

app.post('/', async(req, res) => {
    /*let category = req.body.category;
    let people = req.body.pnum;
    let time = req.body.time;
    let mylist = [];
    let prefer = req.body.prefer;
    let hate = req.body.hate;
    let lon = req.body.lon;
    let lat = req.body.lat;*/
    let date = new Date();
    let hour = date.getHours();
    let minute = date.getMinutes();
    let newhour = hour;
    let newminute;
    if(minute > 30){
        newminute = 30;
    }
    else{
        newminute = 0;
    }
    let wdate = new Date();
    wdate.setHours(newhour, newminute);
    console.log(date);
    console.log(wdate);
    var mylist;
    let category = ["양식", "중식", "일식", "PC방", "볼링장", "노래방", "코인 노래방", "공원", "당구장", "방탈출", "박물관", "보드 게임 카페", "카페", "주점", "미술관", "연극극장", "백화점", "마사지", "아쿠아리움", "사진관", "만화카페"];
    let hate = ["양식", "중식", "일식"];
    let map = new Object();
    let lon = 126.929810;
    let lat = 37.488201;
    map.Re = 6371.00877;
    map.grid = 5.0;
    map.slat1 = 30.0;
    map.slat2 = 60.0;
    map.olon = 126.0;
    map.olat = 38.0;
    map.xo = 210/map.grid;
    map.yo = 675/map.grid;
    let XY = getXY(lon, lat, map);
    console.log(XY);
    let raining = await checkWeather(wdate, XY);
    console.log(raining);
    fs.readFile('time.json', 'utf8', function (err, data) {
        if (err) {
            console.log(err);
            res.status(404).send(err);
            res.end();
        }
        let contents = JSON.parse(data);
        mylist = findFromContents(category, contents);
        mylist = findHate(mylist, hate);
        console.log("final list");
        console.log(mylist);
        res.status(200);
        res.json([{
            "place_name": "카카오프렌즈 코엑스점",
            "distance": "418",
            "place_url": "http://place.map.kakao.com/26338954",
            "category_name": "가정,생활 > 문구,사무용품 > 디자인문구 > 카카오프렌즈",
            "address_name": "서울 강남구 삼성동 159",
            "road_address_name": "서울 강남구 영동대로 513",
            "id": "26338954",
            "phone": "02-6002-1880",
            "category_group_code": "",
            "category_group_name": "",
            "x": "127.05902969025047",
            "y": "37.51207412593136"
          }]);
        //res.json(mylist);
    });
})

function findHate(from, condition){
    let newlist = [];
    for(let i in from){
        let donothate = true;
        for(let j in condition){
            if(from[i].type == condition[j]){
                donothate = false;
                break;
            }
        }
        if(donothate){
            newlist.push(from[i]);
        }
    }
    return newlist;
}

function findPref(from, condition){
    let newlist = [];
    for(let i in from){
        for(let j in condition){
            if(from[i].type == condition[j]){
                list.push(from[i]);
                break;
            }
        }
    }
    return newlist;
}

function findFromContents(from, content){
    let newlist = [];
    for(let i in from){
        for(let j in content){
            if(from[i] == content[j].type){
                newlist.push(content[j]);
                break;
            }
        }
    }
    
    return newlist;
}

function getXY(lon, lat, map){
    let PI = Math.PI;
    let DEGRAD = PI / 180.0;
    let re = map.Re / map.grid;
    let slat1 = map.slat1 * DEGRAD;
    let slat2 = map.slat2 * DEGRAD;
    let olon = map.olon * DEGRAD;
    let olat = map.olat * DEGRAD;
    let sn = Math.tan(PI * 0.25 + slat2 * 0.5) / Math.tan(PI * 0.25 + slat1 * 0.5);
    sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
    let sf = Math.tan(PI*0.25 + slat1 * 0.5);
    sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;
    let ro = Math.tan(PI * 0.25 + olat * 0.5);
    ro = re * sf / Math.pow(ro, sn);
    let ra = Math.tan(PI * 0.25 + lat * DEGRAD * 0.5);
    ra = re * sf / Math.pow(ra, sn);
    let theta = lon * DEGRAD - olon;
    if(theta > PI){
        theta -= 2 * PI;
    }
    if(theta < -PI){
        theta += 2 * PI;
    }
    theta *= sn;
    let x = ra * Math.sin(theta) + map.xo;
    let y = ro - ra * Math.cos(theta) + map.yo;
    x = parseInt(x + 1.5);
    y = parseInt(y + 1.5);
    return [x, y];
}

async function checkWeather(wdate, loc){
    newhour = wdate.getHours();
    newminute = wdate.getMinutes();
    let url = "http://apis.data.go.kr/1360000/VilageFcstInfoService/getVilageFcst?serviceKey=mg9I4VBCmTi1FupAyPU4QJUjbv98AeUk7CUsce7asBAeDDKgPzQWd3PzXukCX2w2wObVx85vt2KkVqWbzXWfVQ%3D%3D";
    url += "&numOfRows=100";
    url += "&dataType=JSON";
    url += "&pageNo=1";
    url += "&base_date=" + wdate.getFullYear();
    if(wdate.getMonth() + 1 < 10){
        url += 0;
    }
    url += (wdate.getMonth() + 1);
    if(wdate.getDate() < 10){
        url += 0;
    }
    url += wdate.getDate();
    if(newhour < 10){
        url += 0;
    }
    url += "&base_time=" + newhour;
    if(newminute == 0){
        url += "00";
    }
    else{
        url += "30";
    }
    url += "&nx=" + loc[0];
    url += "&ny=" + loc[1];
    console.log(url);
    fetch("http://apis.data.go.kr/1360000/VilageFcstInfoService/getUltraSrtFcst?serviceKey=mg9I4VBCmTi1FupAyPU4QJUjbv98AeUk7CUsce7asBAeDDKgPzQWd3PzXukCX2w2wObVx85vt2KkVqWbzXWfVQ%3D%3D&pageNo=1&numOfRows=100&dataType=JSON&base_date=20210606&base_time=1829&nx=55&ny=127")
    .then(response => response.JSON)
    .then(function(data){
        return data;
    })
    .catch(function(err){
        console.log(err);
        return false;
    })

}

var port = process.env.PORT || 5000;
app.listen(port, function(){
    console.log("server on, port: " + port);
})