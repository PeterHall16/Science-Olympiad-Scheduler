import Schedule from "./Classes/Schedule"
import Competitor, { getBestCompetitor } from "./Classes/Competitor"
import { readEvents, readTeamMembers, populateCompetitors } from "./reader"
import readXlsxFile = require('read-excel-file/node')
import 'source-map-support/register'

let MAX_GRADE = 0
let MAX_QUANTITY = 0
let generations = 1000

function setup(division: string, generations: number) {
    generations = generations
    switch (division.toUpperCase()) {
        case "B":
            MAX_GRADE = 9
            MAX_QUANTITY = 5
            break
        case "C":
            MAX_GRADE = 12
            MAX_QUANTITY = 7
            break
        default:
            throw new Error("'divison' may be only 'B' or 'C'")
    }
}

function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

function generate(eventData, competitors): Schedule {
    // Create object for initial schedule.Probably add something to store all these objects externally later
    let activeSchedule = new Schedule()
    // Create a local instance of eventData[]
    activeSchedule.events = eventData
    // activeSchedule.events = shuffle(activeSchedule.events)

    let seniors = []
    let team = []

    // Assign periods randomly for self - schedule eventData
    for (let obj of activeSchedule.events) {
        if (obj.selfSchedule == true) {
            obj.period = Math.floor((6 * Math.random() + 1))
        }
    }
    // Shuffle the event lsit so that there is no bias as to when the event is
    activeSchedule.events = shuffle(activeSchedule.events)

    // Loop through each event in the current schedule
    for (let event of activeSchedule.events) {
        // Loop through all the possible competitor slots in an event.
        if (event.size > 3 || event.size < 2) {
            throw new Error("Events may only have 2 or 3 participants.")
        }
        for (let i = 0; i < event.size; i++) {
            // If the event isn't filled yet
            let competitor: Competitor = null
            if (event.competitors.length < event.size) {
                // If we can still add people to the team, get the best competitor out of everyone
                if (team.length < 15) {
                    competitor = getBestCompetitor(
                        competitors, event.name, event.period, seniors, MAX_GRADE, MAX_QUANTITY)
                    // If we're full, get the best competitor out of the people on the team already
                } else {
                    competitor = getBestCompetitor(team, event.name, event.period, seniors, MAX_GRADE, MAX_QUANTITY)
                }
            }

            // Now that the competitor has been added to this time slot, they are occupied
            if (competitor) {
                competitor.occupied.push(event.period)
                // Add the competitor to the list of poeple competing in the event
                event.competitors.push(competitor)

                // Add the competitor to the list of seniors if they are a senior and aren't already there
                if (competitor.grade == MAX_GRADE && seniors.indexOf(competitor.name) == -1) {
                    seniors.push(competitor.name)
                }
                // Add the competitor to the competing team roster if they aren't already there
                if (team.indexOf(competitor) == -1) {
                    team.push(competitor)
                }
            }
        }
    }

    // Reset the occupied status of the competitors for the next schedule
    for (let c of competitors) {
        c.occupied = []
    }

    activeSchedule.members = team

    return activeSchedule
}

export let readScheduleRows = new Promise((resolve, reject) => {
    readXlsxFile('Data.xlsx', { sheet: 1 }).then((rows) => {
        resolve(rows)
    })
})

export let readRankingsRows = new Promise((resolve, reject) => {
    readXlsxFile('Data.xlsx', { sheet: 2 }).then((rows) => {
        resolve(rows)
    })
})

export function main(generations: number, scheduleRows, rankingsRows): Schedule {
    // setup("C")

    // let readTeam = readTeamMembers(rankingsRows)
    let competitorList: Competitor[] = populateCompetitors(rankingsRows)

    // Create a schedule that will hold the best one
    let best_schedule = new Schedule()
    let best_fitness = 0

    // Generate a schedule for each generation
    for (let i = 0; i < generations; i++) {
        let readEv = readEvents(scheduleRows, rankingsRows)
        let activeSchedule = generate(readEv, competitorList)
        let current_fitness = activeSchedule.fitness()
        // Replace the best schedule if this one is better
        if (current_fitness > best_fitness) {
            best_schedule = activeSchedule
            best_fitness = current_fitness
        }
        activeSchedule = null
    }

    return best_schedule
}

export default function start(generations: number) {
    return new Promise((resolve, reject) => {
        Promise.all([readScheduleRows, readRankingsRows]).then((values) => {
            // Initialize variables
            let scheduleRows = values[0]
            let rankingsRows = values[1]

            let schedule = main(generations, scheduleRows, rankingsRows)
            resolve(schedule)
        }).catch(err => {
            console.error(err);
            reject(err)
        })
    })
}

// Main Process
if (require.main == module) {
    const readline = require("readline");
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question("Select Division (B or C) ", function (division) {
        rl.question("How many generations ", function (generations) {
            setup(division, generations)
            console.log("Optimizing...")
            let hrstart = process.hrtime()
            start(generations).then((schedule: Schedule) => {
                let hrend = process.hrtime(hrstart);
                schedule.display()
                console.info('Execution time (hr): %ds %dms', hrend[0], hrend[1] / 1000000)
            })
            rl.close();
        });
    });
}