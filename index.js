var os = require('os'),
Q = require('q'),
urls = require('./urls.json'),
cheerio = require('cheerio'),
request = require('request');
const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const fs = require("fs");



function sleep(delay) {
    var start = new Date().getTime();
    while (new Date().getTime() < start + delay);
}

async function importHotelInfo(restInfo){
	if(os.platform() == "linux"){
		execSync('apt-get update -y && apt-get install libxss1 -y', (error, stdout, stderr)=>{
			if(error) console.log(error);
			console.log(stdout? "Updating System & Installing Library - libxss1" : stderr);
		});
	}
	var deferred = Q.defer();
	// proxyServer = global.Config.squidProxyServer1;

	const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36';
	const LANGUAGE_HEADERS = {
		'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
	};
	
	const browser = await puppeteer.launch({
		args: [
				'--start-fullscreen',
				'--no-sandbox',
				'--disable-setuid-sandbox',
				// `--proxy-server=${proxyServer}`,
			]
	  });
	const page = await browser.newPage();
	await page.setViewport({ width: 1366, height: 768});
    // page.setDefaultNavigationTimeout(0);
    
    page.setUserAgent(USER_AGENT);
	page.setExtraHTTPHeaders(LANGUAGE_HEADERS);

	await page.goto(restInfo.url,{ waitUntil: 'domcontentloaded', timeout:300000}).then(async (responseBody)=>{
		
		restInfo.url =  page.url().toString();
		restInfo.restId = "zomato";
		try{
    		await responseBody.text().then(text =>{
				restInfo.restId = text.slice(text.indexOf("res_id"),text.indexOf("res_id")+30).split(":")[1].split(",")[0].replace('"','').replace('\\','');
    		})
		}catch(error){
			
		}

		restInfo.restName = "";
		try{
			let nameSelector = await page.$x('//*[@id="root"]/div/main/div/section[3]/section/section[1]/div/h1/text()');
			restInfo.restName = await page.evaluate(el =>el.textContent, nameSelector[0]);
		}catch(error){
			
		}
		
		restInfo.phone="";
		try{
			let phoneSelector = await page.$x('//*[@id="root"]/div/main/div/section[4]/section/article/p')
			restInfo.phone = await page.evaluate(el =>el.textContent, phoneSelector[0]);
		}catch(error){
			
		}
		
		restInfo.averageCostForTwo="";
		try{
			let costSelector = await page.$x('//*[@id="root"]/div/main/div/section[4]/section/section/article[1]/section[contains(.,"₹")]')
			restInfo.averageCostForTwo = await page.evaluate(el =>el.innerText.slice(el.innerText.indexOf("₹"),el.innerText.indexOf("₹")+10).replace ( /[^\d]/g, '' ), costSelector[0]);
		}catch(error){
			
		}

		
		restInfo.reviewRatings = {};
		let flag = 0; // flag 1 as dining and 2 as delivery - reviewsCount & rating ; { 0 default to None }
		try{
			let rSelector = await page.$x('//*[@id="root"]/div/main/div/section[3]/section/section[2]')
			let temp = await page.evaluate(el =>el.innerText.toString().split("\n").filter(item => item),rSelector[0]);
			
			if(temp.length == 4){
				restInfo.reviewRatings.diningRating = temp[0];
				restInfo.reviewRatings.diningReview = temp[1].split(" ")[0];
				restInfo.reviewRatings.delivaryRating = temp[2];
				restInfo.reviewRatings.delivaryReview = temp[3].split(" ")[0];
				flag = 1;
			  }else if(temp.length == 3){
				if(temp[0].includes("Dining")){
					restInfo.reviewRatings.delivaryRating = temp[1];
					restInfo.reviewRatings.delivaryReview = temp[2].split(" ")[0];
					flag = 2;
				}else{
					restInfo.reviewRatings.diningRating = temp[0];
					restInfo.reviewRatings.diningReview = temp[1].split(" ")[0];
					flag = 1;
				}
			  }

		}catch(error){
			
		}
		
		

		restInfo.restAddress = "";
		try{
			let addressSelector = await page.$x('//*[@id="root"]/div/main/div/section[4]/section/article/section/p');
			restInfo.restAddress = await page.evaluate(el => el.textContent,addressSelector[0]);
		}catch(error){
			
		}


		restInfo.restLatitude = "", 
		restInfo.restLongitude = "";
		try{
			let latLongSelector = await page.$x('//*[@id="root"]/div/main/div/section[3]/div[1]/section/a');
			let latLong = await page.evaluate(el => el.href.split("ion=")[1].split(","),latLongSelector[0]);
			restInfo.restLatitude = latLong[0];
			restInfo.restLongitude = latLong[1];
		}catch(error){
			
		}
		
		restInfo.restStatus = "";
		try{
			let restStatus = await page.$x('//*[@id="root"]/div/main/div/section[3]/section/section[1]/section[2]/section/span[1]/text()');
			restInfo.restStatus = await page.evaluate(el =>el.textContent, restStatus[0]);
		}catch(error){
			
		}

		restInfo.orderOnlineAvailable = false;
		restInfo.restBookingAvailable = false;
		try{
			let OOSelector = await page.$x('//a[contains(.,"Order Online")]');
			if(OOSelector.length != 0){
				restInfo.orderOnlineAvailable = true
			}
			let bookingSelector = await page.$x('//a[contains(.,"Book a Table")]');
			if(bookingSelector.length !=0){
				restInfo.restBookingAvailable = true;
			}
		}catch(error){
			
		}

		restInfo.restZomatoGoldStatus = "No";
		try{
			let zmGoldSelector = await page.$x('//*[@id="root"]/div/main/div/section[2]/div[2]/div/img');
			if(zmGoldSelector.length != 0){
				restInfo.restZomatoGoldStatus = "Yes";
			}
		}catch(error){
			
		}



		restInfo.noOfPhotos = 0
		try{
			let photoButton = await page.$x('//a[contains(.,"Photos")]')
			await page.evaluate(el =>el.click(),photoButton[0]);
			await page.waitForXPath('//span[contains(.,"All (")]');
			let photoSelector = await page.$x('//span[contains(.,"All (")]');
			
			restInfo.noOfPhotos = parseInt(await page.evaluate(el => el.innerText.split('(')[1].split(')')[0],photoSelector[0]));
		
		}catch(error){
			
		}

		restInfo.noOfReviews = 0
		try{
			let reviewButton = await page.$x('//a[contains(.,"Reviews")]')
			await page.evaluate(el =>el.click(),reviewButton[0]);
			await page.waitForXPath('//span[contains(.,"All Reviews (")]');
			let reviewSelector = await page.$x('//span[contains(.,"All Reviews (")]');
			
			restInfo.noOfReviews = parseInt(await page.evaluate(el => el.innerText.split('(')[1].split(')')[0],reviewSelector[0]));
		
		}catch(error){
			
		}
		

		// On zomato website votes count can be found in many ways like, in multiple of 1000 (K) as 17.8K  or Comma separated as 1,234
		// hence needs to be parsed so that ES will not throw exception.

		// try{
		// 	restInfo.restVotesCount = restInfo.restVotesCount[restInfo.restVotesCount.length -1] == "K" ? parseFloat(restInfo.restVotesCount)*1000 : parseFloat(restInfo.restVotesCount.replace(',',''));
		// 	restInfo.restVotesCount = restInfo.restVotesCount > restInfo.noOfReviews ? restInfo.restVotesCount : restInfo.noOfReviews
		// 	restInfo.restRating = parseFloat(restInfo.restRating);
		// }catch(error){console.log('Error in parsing votes : ',error);}

		restInfo.updatedAt = (new Date()).toISOString();
		try{
			await page.close();
    		await browser.close();
		}catch(err){console.log("Unable to close scraping tab/browser");}

		deferred.resolve(restInfo);
	})
	.catch(error =>{
		console.log("Failed while hotel info scraping with error: " + error);
		// setZomatoMessage('Zomato scrapping failed: Failed while hotel-info scrap');
		deferred.reject(error);
	})

	return deferred.promise;
}



// let finalOutJson = [];
async function processRestInfo(){

	urls = urls.slice(0,50);
	// urls = ["https://www.zomato.com/ncr/noida-social-sector-18-noida"];

	for(let start_index=0;start_index<urls.length;start_index++){
		let restInfo = {};
		console.log(`Step ${start_index+1} of ${urls.length}`);
		restInfo.url = urls[start_index];
		sleep(1000)
		try{
			let info = await importHotelInfo(restInfo);
			console.log(`Total review count : ${info.noOfReviews}`);
			// info.allReviews = await importReviewInfo(info)
			if(info.noOfReviews >0){
				// info.url = info.url + '?'+info.noOfReviews;
				// readAndAppend('review_urls.json',info.url)
				readAndAppend('restIds.json',info.restId)
			}

			readAndAppend('out.json',info);
		}catch(e){
			continue;
		}
		
		
	}

	console.log("process completed");

	
}

function readAndAppend(filename,data){
	let fileJson = fs.readFileSync(filename,"utf-8");
	let infoJson = JSON.parse(fileJson)
	infoJson.push(data);
	fileJson = JSON.stringify(infoJson);
	fs.writeFileSync(filename,fileJson,"utf-8");

}

processRestInfo()