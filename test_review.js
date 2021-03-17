var os = require('os'),
Q = require('q'),
// urls = require('./urls.json'),
cheerio = require('cheerio'),
request = require('request');

const fs = require("fs");
// var restids = require('./restIds.json')

// var reviewUrls = require('./review_urls.json');


async function getReviewForUrl(url){
    let data;
    var deferred = Q.defer();
    url = encodeURI(url)
    let headers = {
		'connection':'Keep-Alive',
		'accept-language':'en-GB,en-US;q=0.8,en;q=0.6',
		'accept':'*/*',
		'accept-charset':'GBK,utf-8;q=0.7,*;q=0.3',
		'cache-control':'max-age=0',
		'origin':'https://www.zomato.com',
		'authority':'www.zomato.com',
		// 'path': '/ncr/the-chinese-thai-restaurant-safdarjung-new-delhi'
	};
    let referrers = [
        'https://www.zomato.com/'
        ];
    headers['referer'] = referrers[0]
    request({
		url: url,
		method: 'GET',
		headers: headers
		// proxy: proxyServer

	}, function (error, response, body) {
		flag = true;
		if (error || !body || response.statusCode !== 200) {

			console.log(error)

			deferred.reject(error);
		} else {
			// ImportZomatoData.logger.info("Successfull Response from zomato review url");
			deferred.resolve(body)	
		}
	})	

    return deferred.promise;
}



async function filterReviewData(data){
    let noOfPages = data.page_data.sections.SECTION_REVIEWS.numberOfPages,
    currentPage = data.page_data.sections.SECTION_REVIEWS.currentPage;

    let returnData={};
    console.log(noOfPages+','+currentPage);
    returnData.noOfPages = noOfPages;
    returnData.currentPage = currentPage;
    returnData.reviews = []

    Object.keys(data.entities.REVIEWS).forEach(function(key) {
        let temp = {};
        temp.name = data.entities.REVIEWS[key].userName?data.entities.REVIEWS[key].userName:"NA"
        temp.date = data.entities.REVIEWS[key].timestamp
        temp.text = data.entities.REVIEWS[key].reviewText
        if(data.entities.REVIEWS[key].rating.entities){
            let ratingid = data.entities.REVIEWS[key].rating.entities[0].entity_ids[0];
            temp.rating = data.entities.RATING[ratingid].rating
        }
        temp.photosCount = data.entities.REVIEWS[key].reviewPhotos.entities? data.entities.REVIEWS[key].reviewPhotos.entities[0].entity_ids.length:0;

        returnData.reviews.push(temp);
    });
    
    return returnData
    
}

async function processReviews(restId,page){
    let url = `https://www.zomato.com/webroutes/reviews/loadMore?res_id=${restId}&page=${page}&limit=100`
    let data = await getReviewForUrl(url);
    data = await filterReviewData(JSON.parse(data))
    console.log(restId)
    return data;
}


async function getAllReviews(restIds){
    // restIds = restIds.slice(0,10);
    
    for(let i=0;i<restIds.length;i++){
        let reviewsJson ={};    
        reviewsJson[`${restIds[i]}`] = [];
        // 18371428
        
        try{
            let data = await processReviews(restIds[i],1)
            if(data.reviews.length>0){reviewsJson[`${restIds[i]}`].push(...data.reviews);}
            while(data.noOfPages && data.currentPage && data.noOfPages > 1 && data.currentPage < data.noOfPages && data.currentPage<=10){
                if(data.currentPage ==10){
                    data = await processReviews(restIds[i],data.noOfPages)
                }else if(data.currentPage<10){
                    data = await processReviews(restIds[i],data.currentPage+1)
                }
                if(data.reviews){reviewsJson[`${restIds[i]}`].push(...data.reviews);}
                
            }
            // console.log(JSON.stringify(reviewsJson[`${restIds[i]}`].length));
            if(reviewsJson[`${restIds[i]}`].length>0)await readAndAppend('./tss.json',reviewsJson);
            
        }catch(e){
            continue;
        }
    }
    
}



async function readAndAppend(filename,data){
	if(fs.existsSync(filename)){
        console.log("Updating data...")
        let fileJson = fs.readFileSync(filename,"utf-8");
        let infoJson = JSON.parse(fileJson)
        infoJson.push(data);
        fileJson = JSON.stringify(infoJson);
        fs.writeFileSync(filename,fileJson,"utf-8");
    }
    else{
        console.log("No file found creating new & inserting data");
        data = [data]
        fs.writeFileSync(filename,JSON.stringify(data),"utf-8")

    }
}

// getAllReviews(["18371428","307274","9930","3941","311030","2724","310752","8189","3940","18349896","3195","3565","18369749","18355037","18204816","18360027","1600","18228881","2726","9948","301878","6645","310788","18294221","312495","18222583","18361752","302821","18352293","313410","4398","312772","3910","2437"])

getAllReviews(['1600','2724'])
// readAndAppend('./test.json',testData)
