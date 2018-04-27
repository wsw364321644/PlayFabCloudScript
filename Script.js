handlers.Info = function (args, context) {
    var arrayOfStrings=[];
    let serviceInfo;
    if (args && args.buildversion){
        let buildversion = args.buildversion;
        arrayOfStrings = buildversion.split('-');
    }
    log.info(arrayOfStrings.length);
    if(arrayOfStrings.length>1){
        log.info(arrayOfStrings[1].length);
    }
    if (arrayOfStrings.length<2||arrayOfStrings[1].length==1){
        serviceInfo={
            "ServiceName": "UberPy",
            "Configuration": "Development",
            "Version": 0,
            "LobbyServer": "loadout.sonkwo.com"
        }
    }else{
        serviceInfo= {
            "ServiceName": "UberPy",
            "Configuration": "Development",
            "Version": 0,
            "LobbyServer": "127.0.0.1"
        }
    }
    let matchmakerInfo={
        "118.190.45.37:8001":[]
    }
    return{
        "ServiceInfo" :serviceInfo,
        "MatchmakerInfo":matchmakerInfo
    }
};

const dayofms=86400000

function calcLevelReward(dailyRewards,day,today,level) {
    let specialDailyRewards=null;
    let levelReward=null;
    let specialIndex=0;
    for(let val of dailyRewards['SpecialDailyRewards']){
        if(val.hasOwnProperty('UseSpecialReward')&&val.UseSpecialReward&&val.hasOwnProperty("StartDate")){
            let startDate=new Date(val.StartDate)
            if(startDate.getTime()<today.getTime()&&(startDate.getTime()+val.Duration*dayofms)>today.getTime()){
                specialDailyRewards=val;
                break;
            }
        }
        specialIndex++;
    }
    if(specialDailyRewards){
        var specialDailyReward=specialDailyRewards[day.toString()];
        for(let val of specialDailyReward){
            if(val['StartLevel']<=level &&(levelReward==undefined ||val['StartLevel']>levelReward['StartLevel']) ){
                levelReward=val;
            }
        }
    }
    log.info(levelReward)
    if(!levelReward){
        let dailyReward=dailyRewards[day.toString()]
        for(let val of dailyReward){
            if(val['StartLevel']<=level &&(levelReward==undefined ||val['StartLevel']>levelReward['StartLevel']) ){
                levelReward=val;
            }
        }
    }
    return {LevelReward:levelReward,
        UseSpecialReward:specialDailyRewards!=null,
        SpecialDailyRewards:specialDailyRewards,
        SpecialIndex:specialIndex}
}


handlers.GetDailyBonus = function (args, context) {
    var level=0;
    var levelRewardRes=null;
    var dailyInfo;
    let res;
    function createData(hasNew,dailyInfo) {
        let data={HasNew:hasNew};
        if(dailyInfo.hasOwnProperty('BonusCount')){
            data.BonusCount=dailyInfo.BonusCount;
            data.RewardLevels=dailyInfo.RewardLevels;
            data.SpecialBonusCount=dailyInfo.SpecialBonusCount;
            if(dailyInfo.hasOwnProperty('LastCheckinTime')){
                data.LastCheckinTime=dailyInfo.LastCheckinTime;
            }
            if(dailyInfo.SpecialIndex){
                data.SpecialDailyRewards=levelRewardRes.specialDailyRewards;
            }
        }
        return data;
    }
    function getIndexOfCycle(data) {
        return (data.getUTCDay()==0?7:data.getUTCDay());
    }
    function prepareAward() {
        let request = {
            PlayFabId: currentPlayerId,
            Keys: ["Challenges:V7.0"]
        };
        let challengesResult=server.GetUserReadOnlyData(request)
        if(challengesResult.Data.hasOwnProperty("Challenges:V7.0")){
            var challenges=JSON.parse(challengesResult.Data['Challenges:V7.0'].Value);
            level=challenges.Level;
        }

        request = {
            Keys: ["DailyRewards"]
        };
        let dailyRewardsResult=server.GetTitleData(request);

        if(!dailyRewardsResult.Data.hasOwnProperty("DailyRewards")){
            return {status:"reward not exist",code:500};
        }else{
            let dailyRewardsJson=JSON.parse(dailyRewardsResult.Data.DailyRewards)
            levelRewardRes=calcLevelReward(dailyRewardsJson,dailyInfo.BonusCount-1,today,level);
        }
    }
    function InitialDailyInfo() {
        return {
            BonusCount:0,
            RewardLevels:[],
            LastCheckinTime:0,
            SpecialBonusCount:0,
            SpecialIndex:null
        }
    }
    try{
        let checkonly=false;
        if (args && args.checkonly){
            checkonly = args.checkonly;
        }
        let request = {
            PlayFabId: currentPlayerId,
            Keys: ["DailyInfo"]
        };
        let dailyInfoResult=server.GetUserReadOnlyData(request)
        var today = new Date();
        if(dailyInfoResult.Data.hasOwnProperty("DailyInfo")){
            dailyInfo=JSON.parse(dailyInfoResult.Data.DailyInfo.Value);
            if(dailyInfo.hasOwnProperty("LastCheckinTime")){
                var lastCheckinTime =new Date(dailyInfo.LastCheckinTime);
                lastCheckinTime.setUTCHours(0,0,0,0)
            }
            if(lastCheckinTime
            &&(!(getIndexOfCycle(today)>=getIndexOfCycle(lastCheckinTime)&&today.getTime()-lastCheckinTime.getTime()<7*dayofms)
            ||dailyInfo.BonusCount>getIndexOfCycle(lastCheckinTime)
            ||(dailyInfo.RewardLevels&&dailyInfo.RewardLevels.length!=dailyInfo.BonusCount))
            ){
                dailyInfo=InitialDailyInfo();
            }
        }else{
            if (checkonly)
                return{status:"ok",code:200,
                    data:{HasNew:true}}
            dailyInfo=InitialDailyInfo();
        }
        let couldCheckin=true;

        if(lastCheckinTime&&lastCheckinTime.getFullYear()==today.getFullYear()
        &&lastCheckinTime.getUTCMonth()==today.getUTCMonth()
        &&lastCheckinTime.getUTCDate()==today.getUTCDate()){
            couldCheckin=false
        }
        if(checkonly&&!couldCheckin){
            return{status:"already checkin",code:200,
                data:{HasNew:false}}
        }else if(!couldCheckin){
            res=prepareAward()
            if(res!=true) return res;
            return {status:"already checkin",code:200,
                data:createData(false,dailyInfo)}
        }else if(checkonly){
            return{status:"ok",code:200,
                data:{HasNew:true}}
        }

        /**********************begin to award **************************/
        dailyInfo.BonusCount+=1;
        dailyInfo.RewardLevels.push(level)
        dailyInfo.LastCheckinTime=today.getTime();
        res=prepareAward()
        if(res) return res;
        if(levelRewardRes.UseSpecialReward){
            dailyInfo.SpecialBonusCount+=1;
            dailyInfo.SpecialIndex=levelRewardRes.SpecialIndex
        }else{
            dailyInfo.SpecialIndex=null;
        }


        let qdResID=null
        let itemInstanceId=null
        var levelReward=levelRewardRes.LevelReward
        if(levelReward){
            if(levelReward.RewardType=="VirtualCurrency"){
                request = {
                    PlayFabId:currentPlayerId,
                    VirtualCurrency:levelReward.PlayfabCurrency,
                    Amount:levelReward.Amount
                };
                server.AddUserVirtualCurrency(request)
            }else if(levelReward.RewardType=="BoosterPack"){
                request = {
                    PlayFabId:currentPlayerId,
                    ItemIds:[levelReward.ItemId],
                    Annotation:"DailyReward"
                };
                let grantItemsResult=server.GrantItemsToUser(request);
                if(!grantItemsResult.ItemGrantResults[0].Result){
                    return {status:"grant error",code:500};
                }
                qdResID=levelReward.QDResID;
                itemInstanceId=grantItemsResult.ItemGrantResults[0].ItemInstanceId
            }
        }
        request = {
            PlayFabId: currentPlayerId,
            Data: {
                DailyInfo:JSON.stringify(dailyInfo)
            }
        };
        let updateResult=server.UpdateUserReadOnlyData(request);
        res=createData(false,dailyInfo);
        res.QDResID=qdResID;
        res.ItemInstanceId=itemInstanceId;
        return {status:"ok",code:200,
            data:res}
    }catch (ex) {
        log.error(ex);
        return {status:"error",detail:ex};
    }

};

handlers.GetGameServerRegions = function (args, context) {
    return {"Regions": [{"Available": true, "Name": "Australia", "GameCount": 0, "GameModes": [], "PingUrl": "http://10.1.1.223:8000/ping", "GamePlayersCount": 0},
        {"Available": true, "Name": "APSouthEast", "GameCount": 0, "GameModes": [], "PingUrl": "http://10.1.1.223:8000/ping", "GamePlayersCount": 0},
        {"Available": true, "Name": "USWest", "GameCount": 0, "GameModes": [], "PingUrl": "http://10.1.1.223:8000/ping", "GamePlayersCount": 0},
        {"Available": true, "Name": "USEast", "GameCount": 0, "GameModes": [], "PingUrl": "http://10.1.1.223:8000/ping", "GamePlayersCount": 0},
        {"Available": true, "Name": "SAEast", "GameCount": 0, "GameModes": [], "PingUrl": "http://10.1.1.223:8000/ping", "GamePlayersCount": 0},
        {"Available": true, "Name": "China", "GameCount": 0, "GameModes": [], "PingUrl": "http://10.1.1.223:8000/ping", "GamePlayersCount": 0},
        {"Available": true, "Name": "EUWest", "GameCount": 0, "GameModes": [], "PingUrl": "http://10.1.1.223:8000/ping", "GamePlayersCount": 0},
        {"Available": true, "Name": "APNorthEast", "GameCount": 0, "GameModes": [], "PingUrl": "http://10.1.1.223:8000/ping", "GamePlayersCount": 0},
        {"Available": true, "Name": "USCentral", "GameCount": 1, "GameModes": [{"GameCount": 1, "GameMode": "3346578531", "GamePlayersCount": 1}], "PingUrl": "http://10.1.1.223:8000/ping", "GamePlayersCount": 1}]}
};

// This is a simple example of making a web request to an external HTTP API.
handlers.makeHTTPRequest = function (args, context) {
    var headers = {
        "X-MyCustomHeader": "Some Value"
    };

    var body = {
        input: args,
        userId: currentPlayerId,
        mode: "foobar"
    };

    var url = "http://httpbin.org/status/200";
    var content = JSON.stringify(body);
    var httpMethod = "post";
    var contentType = "application/json";

    // The pre-defined http object makes synchronous HTTP requests
    var response = http.request(url, httpMethod, content, contentType, headers);
    return { responseContent: response };
};

// This is a simple example of a function that is called from a
// PlayStream event action. (https://playfab.com/introducing-playstream/)
handlers.handlePlayStreamEventAndProfile = function (args, context) {

    // The event that triggered the action
    // (https://api.playfab.com/playstream/docs/PlayStreamEventModels)
    var psEvent = context.playStreamEvent;

    // The profile data of the player associated with the event
    // (https://api.playfab.com/playstream/docs/PlayStreamProfileModels)
    var profile = context.playerProfile;

    // Post data about the event to an external API
    var content = JSON.stringify({ user: profile.PlayerId, event: psEvent.EventName });
    var response = http.request('https://httpbin.org/status/200', 'post', content, 'application/json', null);

    return { externalAPIResponse: response };
};


// This is an example of using PlayStream real-time segmentation to trigger
// game logic based on player behavior. (https://playfab.com/introducing-playstream/)
// The function is called when a player_statistic_changed PlayStream event causes a player
// to enter a segment defined for high skill players. It sets a key value in
// the player's internal data which unlocks some new content for the player.
handlers.unlockHighSkillContent = function (args, context) {
    var playerStatUpdatedEvent = context.playStreamEvent;
    var request = {
        PlayFabId: currentPlayerId,
        Data: {
            "HighSkillContent": "true",
            "XPAtHighSkillUnlock": playerStatUpdatedEvent.StatisticValue.toString()
        }
    };
    var playerInternalData = server.UpdateUserInternalData(request);
    log.info('Unlocked HighSkillContent for ' + context.playerProfile.DisplayName);
    return { profile: context.playerProfile };
};
