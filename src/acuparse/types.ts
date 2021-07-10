export interface ITower {
    name: string,
    tempF: number,
    relH: string,
    lastUpdated: string
}

export interface ITowerList {
    [key: string]: ITower
}

export interface ITowerListResult {
    towers: ITowerList
}
