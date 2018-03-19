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
                        hascheckin:false
                    }}
            var dailyInfo={};
        }
        let couldCheckin=true;
        if(dailyInfo.hasOwnProperty("LastCheckinTime")){
            var lastCheckinTime =new Date(dailyInfo.LastCheckinTime*1000);
            var today = new Date();
            if(lastCheckinTime.getYear()==today.getYear()&&lastCheckinTime.getMonth()==today.getMonth()&&lastCheckinTime.getDate()==today.getDate()){
                couldCheckin=false
            }
        }

        if(!couldCheckin){
            return {status:"already checkin",code:200,
                data:{
                    hascheckin:true,
                    BonusCount:dailyInfo.BonusCount,
                    LastCheckinTime:dailyInfo.LastCheckinTime,
                    RewardLevels:dailyInfo.RewardLevels
                }}
        }else if(checkonly){
            return{status:"ok",code:200,
                data:{
                    hascheckin:false,
                    BonusCount:dailyInfo.BonusCount,
                    LastCheckinTime:dailyInfo.LastCheckinTime,
                    RewardLevels:dailyInfo.RewardLevels
                }}
        }

        request = {
            PlayFabId: currentPlayerId,
            Keys: ["Challenges:V7.0"]
        };
        let challengesResult=server.GetUserReadOnlyData(request)
        log.info(challengesResult)
        if(challengesResult.Data.hasOwnProperty("Challenges:V7.0")){
            var challenges=JSON.parse(challengesResult.Data['Challenges:V7.0'].Value);
            var level=challenges.Level
        }else{
            level=0
        }

        request = {
            Keys: ["DailyRewards"]
        };
        let dailyRewardsResult=server.GetTitleData(request)
        log.info(dailyRewardsResult)
        if(!dailyRewardsResult.Data.hasOwnProperty("DailyRewards")){
            return {status:"reward not exist",code:201};
        }else{
            let dailyRewards=JSON.parse(dailyRewardsResult.Data.DailyRewards)
            log.info(1)
            let day=today.getDay()
            log.info(typeof(day))
            var dailyReward=dailyRewards[today.getDay().toString()]
        }
        log.info(dailyReward)

        if(dailyInfo.hasOwnProperty("LastCheckinTime")
        &&(today.getDay()==0?7:today.getDay())>lastCheckinTime.getDay()
        &&today.getDate()-lastCheckinTime.getDate()<7){
            dailyInfo.BonusCount+=1;
            dailyInfo.RewardLevels.push(level)
        }else{
            dailyInfo.BonusCount=1;
            dailyInfo.RewardLevels=[level]
        }
        dailyInfo.LastCheckinTime=Date.now()/1000;
        request = {
            PlayFabId: currentPlayerId,
            Data: {
                DailyInfo:JSON.stringify(dailyInfo)
            }
        };
        let updateResult=server.UpdateUserReadOnlyData(request);
        return {status:"ok",code:200,
            data:{
                BonusCount:dailyInfo.BonusCount,
                LastCheckinTime:dailyInfo.LastCheckinTime,
                RewardLevels:dailyInfo.RewardLevels
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


// In addition to the Cloud Script handlers, you can define your own functions and call them from your handlers.
// This makes it possible to share code between multiple handlers and to improve code organization.
handlers.updatePlayerMove = function (args) {
    var validMove = processPlayerMove(args);
    return { validMove: validMove };
};


// This is a helper function that verifies that the player's move wasn't made
// too quickly following their previous move, according to the rules of the game.
// If the move is valid, then it updates the player's statistics and profile data.
// This function is called from the "UpdatePlayerMove" handler above and also is
// triggered by the "RoomEventRaised" Photon room event in the Webhook handler
// below.
//
// For this example, the script defines the cooldown period (playerMoveCooldownInSeconds)
// as 15 seconds. A recommended approach for values like this would be to create them in Title
// Data, so that they can be queries in the script with a call to GetTitleData
// (https://api.playfab.com/Documentation/Server/method/GetTitleData). This would allow you to
// make adjustments to these values over time, without having to edit, test, and roll out an
// updated script.
function processPlayerMove(playerMove) {
    var now = Date.now();
    var playerMoveCooldownInSeconds = 15;

    var playerData = server.GetUserInternalData({
        PlayFabId: currentPlayerId,
        Keys: ["last_move_timestamp"]
    });

    var lastMoveTimestampSetting = playerData.Data["last_move_timestamp"];

    if (lastMoveTimestampSetting) {
        var lastMoveTime = Date.parse(lastMoveTimestampSetting.Value);
        var timeSinceLastMoveInSeconds = (now - lastMoveTime) / 1000;
        log.debug("lastMoveTime: " + lastMoveTime + " now: " + now + " timeSinceLastMoveInSeconds: " + timeSinceLastMoveInSeconds);

        if (timeSinceLastMoveInSeconds < playerMoveCooldownInSeconds) {
            log.error("Invalid move - time since last move: " + timeSinceLastMoveInSeconds + "s less than minimum of " + playerMoveCooldownInSeconds + "s.");
            return false;
        }
    }

    var playerStats = server.GetPlayerStatistics({
        PlayFabId: currentPlayerId
    }).Statistics;
    var movesMade = 0;
    for (var i = 0; i < playerStats.length; i++)
        if (playerStats[i].StatisticName === "")
            movesMade = playerStats[i].Value;
    movesMade += 1;
    var request = {
        PlayFabId: currentPlayerId, Statistics: [{
            StatisticName: "movesMade",
            Value: movesMade
        }]
    };
    server.UpdatePlayerStatistics(request);
    server.UpdateUserInternalData({
        PlayFabId: currentPlayerId,
        Data: {
            last_move_timestamp: new Date(now).toUTCString(),
            last_move: JSON.stringify(playerMove)
        }
    });

    return true;
}

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
