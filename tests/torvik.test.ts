import test from "node:test";
import assert from "node:assert/strict";
import { parseTorvikRatings, parseTorvikFactors, parseTorvikPlayers, findTorvikTeam, torvikSeason, torvikCsv, type TorvikTeam } from "../lib/torvikData.ts";
import { basketballWeek, basketballWeekBounds, basketballGameInSeason } from "../lib/basketballRules.ts";

const csv = 'rank,team,conf,record,adjoe,oe Rank,adjde,de Rank,barthag,rank,proj. W,Proj. L,sos,adjt\r\n31,Villanova,BE,0-0,118,23,98.5,43,.8885,31,19.8,11.2,0,70.5\r\n82,Notre Dame,ACC,0-0,112.1,75,102.1,98,.7456,82,15.8,14.2,0,69.7\r\n';
test("Torvik ratings retain ranks, calculate adjusted margin and distinguish preseason from observed zero", () => {
  const teams = parseTorvikRatings(csv);
  assert.equal(teams.length, 2);
  assert.equal(teams[0].metrics.adjoe.rank, 23);
  assert.equal(teams[0].metrics.margin.value, 19.5);
  assert.equal(teams[0].metrics.sos.value, null);
  assert.equal(teams[0].metrics.projW.value, 19.8);
  assert.equal(parseTorvikRatings(csv.replace('0-0','1-0'))[0].metrics.sos.value, 0);
  assert.throws(() => parseTorvikRatings('<html>Verifying Browser</html>'));
  assert.throws(() => parseTorvikRatings('team,number\nDuke,123'));
});
test("Four Factors keep each repeated rank beside its own stat", () => {
  const [team] = parseTorvikFactors('TeamName,eFG%,Rk,eFG% Def,Rk,FTR,Rk,DR%,Rk\n"Saint Mary\'s",55,12,48,30,0,365,25,10');
  assert.equal(team.name, "Saint Mary's");
  assert.deepEqual(team.metrics.efg, { value: 55, rank: 12 });
  assert.deepEqual(team.metrics.defEfg, { value: 48, rank: 30 });
  assert.deepEqual(team.metrics.ftr, { value: 0, rank: 365 });
  assert.deepEqual(team.metrics.oppOrb, { value: 25, rank: 10 });
});
test("CSV quoted names, embedded commas, escaped quotes and incomplete downloads", () => {
  assert.deepEqual(torvikCsv('a,b\n"Doe, \"\"Junior\"\"",x\n'), [['a','b'],['Doe, "Junior"','x']]);
  assert.throws(() => torvikCsv('a,b\n"unfinished,x'));
});
test("team mapping matches schools without confusing similarly named teams", () => {
  const team = (name: string): TorvikTeam => ({ name, conference:'', record:'0-0', games:0, metrics:{}, players:[] });
  const teams=[...parseTorvikRatings(csv), ...['Michigan','Michigan St.','Miami FL','Miami OH','Connecticut','Mississippi','Mississippi St.','Appalachian St.','Cal St. Fullerton','Illinois Chicago','Loyola MD','IUPUI','Tennessee Martin'].map(team)];
  assert.equal(findTorvikTeam(teams,'Villanova Wildcats')?.name, 'Villanova');
  assert.equal(findTorvikTeam(teams,'Notre Dame Fighting Irish')?.name, 'Notre Dame');
  assert.equal(findTorvikTeam(teams,'Michigan State Spartans')?.name, 'Michigan St.');
  assert.equal(findTorvikTeam([team('Michigan')],'Michigan State Spartans'), null);
  assert.equal(findTorvikTeam(teams,'Miami (OH) RedHawks')?.name, 'Miami OH');
  assert.equal(findTorvikTeam(teams,'Miami Hurricanes')?.name, 'Miami FL');
  assert.equal(findTorvikTeam(teams,'UConn Huskies')?.name, 'Connecticut');
  assert.equal(findTorvikTeam(teams,'Mississippi State Bulldogs')?.name, 'Mississippi St.');
  for (const [espn, torvik] of [['App State Mountaineers','Appalachian St.'],['Cal State Fullerton Titans','Cal St. Fullerton'],['UIC Flames','Illinois Chicago'],['Loyola Maryland Greyhounds','Loyola MD'],['IU Indianapolis Jaguars','IUPUI'],['UT Martin Skyhawks','Tennessee Martin']]) assert.equal(findTorvikTeam(teams,espn)?.name,torvik);
  assert.equal(findTorvikTeam(teams,'Unknown Team'), null);
});
test("player columns require the documented schema and season; fractional shooting becomes percent", () => {
  const row=Array(67).fill('');
  Object.assign(row,{0:'Player, One',1:'Villanova',3:'1',15:'.8',31:'2027',32:'123',50:'2.4'});
  const text=row.map(x=>'"'+x.replaceAll('"','""')+'"').join(',');
  assert.equal(parseTorvikPlayers(text,2027)[0].metrics['FT%'],80);
  assert.equal(parseTorvikPlayers(text,2027)[0].metrics.BPM,2.4);
  assert.equal(parseTorvikPlayers(text,2026).length,0);
  assert.equal(parseTorvikPlayers(text+',extra',2027).length,0);
});
test("season ending year stays 2027 across the new year", () => {
  assert.equal(torvikSeason('2026-11-01T14:30:00Z'),2027);
  assert.equal(torvikSeason('2027-03-15T20:00:00Z'),2027);
});
test("opening Sunday joins the first full card and the next week rolls over Monday", () => {
  assert.equal(basketballGameInSeason('2026-11-01T04:59:59Z'),false);
  assert.equal(basketballGameInSeason('2026-11-01T05:00:00Z'),true);
  assert.equal(basketballWeek(new Date('2026-11-01T14:30:00Z')),1);
  assert.equal(basketballWeekBounds(1).start.toISOString(),'2026-11-01T05:00:00.000Z');
  assert.equal(basketballWeekBounds(1).end.toISOString(),'2026-11-09T06:00:00.000Z');
  assert.equal(basketballWeek(new Date('2026-11-09T06:00:00Z')),2);
});
