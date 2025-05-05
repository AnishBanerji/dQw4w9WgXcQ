from util.database import *
from util.room import getRoomInfo
def achieve(players_list):
    ach_to_stats = {'First Game Played':['gamesPlayed', 1],
                    'First Kill':['playersKilled',1], 
                    'First Task Done':['tasksDone', 1],
                    'First Game Won':['gamesWon', 1],
                    'First Time Saboteur':['saboteurPlayed',1],
                    'Play 5 Games':['gamesPlayed', 5],
                    'Kill 5 Players':['playersKilled',5],
                    'Win 5 Games':['gamesWon',5]}
    ret = {}
    for player in players_list:
        username = player.get('username',None)
        user = userDB.find_one({'username':username})
        stats = user.get('stats')
        achievements = user.get('achievements')
        new_achievements = []
        for ach,stat in ach_to_stats.items():
            if int(stats.get(stat[0])) >= stat[1] and ach not in achievements:
                new_achievements.append(ach)
                achievements.append(ach)
        updated = {'$set':{'achievements':achievements}}
        userDB.update_one({'username':username},updated)
        ret[username] = new_achievements
    return ret


    

