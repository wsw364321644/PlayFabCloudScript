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

function calcLevelReward(dailyRewards,dailyInfo,today,level) {
    let dailyReward=dailyRewards[(dailyInfo.BonusCount-1).toString()];
    let specialDailyReward=null;
    let levelReward=null;
    for(let val of dailyRewards['SpecialDailyRewards']){
        if(val.hasOwnProperty('UseSpecialReward')&&val.UseSpecialReward&&val.hasOwnProperty("StartDate")){
            let startDate=new Date(val.StartDate.replace(/-/g,"/"));
            if(startDate.getTime()<today.getTime()&&startDate.getTime()+val['Duration']*dayofms>today.getTime()){
                specialDailyReward=val;
                break;
            }
        }
    }
    log.info(specialDailyReward)
    if(specialDailyReward){
        for(let val of specialDailyReward){
            if(val['StartLevel']<=level &&(levelReward==undefined ||val['StartLevel']>levelReward['StartLevel']) ){
                levelReward=val;
            }
        }
    }
    log.info(levelReward)
    if(!levelReward){
        for(let val of dailyReward){
            if(val['StartLevel']<=level &&(levelReward==undefined ||val['StartLevel']>levelReward['StartLevel']) ){
                levelReward=val;
            }
        }
    }
    return {LevelReward:levelReward,
        UseSpecialReward:specialDailyReward!=null}
}

handlers.GetDailyBonus = function (args, context) {
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
        if(dailyInfoResult.Data.hasOwnProperty("DailyInfo")){
            var dailyInfo=JSON.parse(dailyInfoResult.Data.DailyInfo.Value);
        }else{
            if (checkonly)
                return{status:"ok",code:200,
                    data:{
                        HasNew:true
                    }}
            var dailyInfo={
                BonusCount:0,
                RewardLevels:[],
                LastCheckinTime:0,
                SpecialBonusCount:0
            };
        }
        let couldCheckin=true;
        var today = new Date();
        if(dailyInfo.hasOwnProperty("LastCheckinTime")){
            var lastCheckinTime =new Date(dailyInfo.LastCheckinTime*1000);
            if(lastCheckinTime.getFullYear()==today.getFullYear()
            &&lastCheckinTime.getUTCMonth()==today.getUTCMonth()
            &&lastCheckinTime.getUTCDate()==today.getUTCDate()){
                couldCheckin=false
            }
        }
        if(!couldCheckin){
            return {status:"already checkin",code:200,
                data:{
                    HasNew:false,
                    BonusCount:dailyInfo.BonusCount,
                    LastCheckinTime:dailyInfo.LastCheckinTime,
                    RewardLevels:dailyInfo.RewardLevels,
                    SpecialBonusCount:dailyInfo.SpecialBonusCount
                }}
        }else if(checkonly){
            return{status:"ok",code:200,
                data:{
                    HasNew:true,
                    BonusCount:dailyInfo.BonusCount,
                    LastCheckinTime:dailyInfo.LastCheckinTime,
                    RewardLevels:dailyInfo.RewardLevels,
                    SpecialBonusCount:dailyInfo.SpecialBonusCount
                }}
        }
        /**********************prepare to award **************************/
        request = {
            PlayFabId: currentPlayerId,
            Keys: ["Challenges:V7.0"]
        };
        let challengesResult=server.GetUserReadOnlyData(request)
        if(challengesResult.Data.hasOwnProperty("Challenges:V7.0")){
            var challenges=JSON.parse(challengesResult.Data['Challenges:V7.0'].Value);
            var level=challenges.Level;
        }else{
            var level=0;
        }

        if(dailyInfo.hasOwnProperty("LastCheckinTime")
        &&(today.getUTCDay()==0?7:today.getUTCDay())>lastCheckinTime.getUTCDay()
        &&today.getTime()-lastCheckinTime.getTime()<7*dayofms){
            dailyInfo.BonusCount+=1;
            dailyInfo.RewardLevels.push(level)
        }else{
            dailyInfo.BonusCount=1;
            dailyInfo.RewardLevels=[level]
            dailyInfo.SpecialBonusCount=0
        }
        dailyInfo.LastCheckinTime=today.getTime()/1000;

        request = {
            Keys: ["DailyRewards"]
        };
        let dailyRewardsResult=server.GetTitleData(request);
        if(!dailyRewardsResult.Data.hasOwnProperty("DailyRewards")){
            return {status:"reward not exist",code:500};
        }else{
            var levelRewardRes=calcLevelReward(JSON.parse(dailyRewardsResult.Data.DailyRewards),dailyInfo,today,level);
            var levelReward=levelRewardRes.LevelReward
        }
        log.info(levelRewardRes)
        if(levelRewardRes.UseSpecialReward){
            dailyInfo.SpecialBonusCount+=1;
        }
        /**********************begin to award **************************/
        let qdResID=null
        let itemInstanceId=null
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
        return {status:"ok",code:200,
            data:{
                HasNew:false,
                BonusCount:dailyInfo.BonusCount,
                LastCheckinTime:dailyInfo.LastCheckinTime,
                RewardLevels:dailyInfo.RewardLevels,
                SpecialBonusCount:dailyInfo.SpecialBonusCount,
                QDResID:qdResID,
                ItemInstanceId:itemInstanceId
            }}
    }catch (ex) {
        log.error(ex);
        return {status:ex.apiErrorInfo.apiError.error,code:ex.apiErrorInfo.apiError.errorCode};
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
