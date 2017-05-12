import React, {Component}  from 'react';
import Services from './../lists/services';
import {Link} from 'react-router-dom';
import PropTypes from 'prop-types';
import config from './../config.json';
import oasisABI from './../abi_oasis.json';
import etherdeltaABI from './../abi_etherdelta.json';
import { createContainer } from 'meteor/react-meteor-data';
import { HTTP } from 'meteor/http'
import BN from 'bn.js';
import EthUtils from 'ethereumjs-util';
import Web3 from 'web3';

export class GenerateReportPage extends Component {

    constructor(props){
        super(props);
        this.state = {
            csv : this.initCSVHeader(),
            oasis: GenerateReportPage.getSimpleMarketContract().at(config.oasis.contract.kovan.address),
            hasPayed: false,
            isLoading: false,

    };
        if (typeof web3 !== 'undefined') {
            web3 = new Web3(web3.currentProvider);
        } else {
            // set the provider you want from Web3.providers
            web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
            console.log("new");
        }
    }

    render(){
        return (
            <div>
                <div className="panel panel-default">
                    <div className="panel-heading">
                        Generate Report
                    </div>
                    <Services
                        services={this.props.services}
                        isLoading={this.state.isLoading}
                    />
                </div>

                <div>
                    {this.generateButton()}
                    <Link to={'/'}>
                        <button type="button" className="btn btn-primary btn-back">Back</button>
                    </Link>
                </div>
            </div>
        );

    }

    generateButton(){
        if(this.state.hasPayed){
            return (
                <button
                    type="button"
                    onClick={this.downloadCSV.bind(this)}
                    className="btn btn-primary btn-generate">Download
                </button>);
        }else {
            return (
                <button
                    type="button"
                    onClick={this.fetch.bind(this)}
                    className="btn btn-primary btn-download">Generate
                </button>);
        }
    }



    static getSimpleMarketContract(){
        return web3.eth.contract(oasisABI);
    }

    fetch(){
        console.log("fetchTrades");

        this.setState({
            isLoading: true,
        });

        let accounts = this.props.services[0].accounts;

      //  for(let i = 0; i < accounts.length; i++) {

         //   const fetchOasisAcceptedTrades = this.fetchAcceptedTrades(accounts[i]);
         //   const fetchOasisLegacyTrades = this.fetchLegacyTrades(accounts[i]);

      //  }
        Promise.all(this.fetchEtherdeltaTradesFromAllContracts(accounts[0])).then( () => {
            this.setState({
                isLoading: false,
                hasPayed: true,
            });

        });
    }



    fetchLegacyTrades(address){
        return new Promise( (resolve, reject) => {
            for (let j = 2; j < 15; j++) {
                HTTP.get(Meteor.absoluteUrl("/maker-otc-" + j + ".trades.json"), (err, result) => {
                    let data = result.data;
                    for (let i = 0; i < data.length; i++) {
                        const maker = EthUtils.addHexPrefix(data[i].taker);
                        if ( maker ===  address.name) {
                            console.log(data[i]);
                            this.addTrade(address, data[i]);
                        }
                    }

                });
            }
            resolve();
        });
    }

   // address tokenGet, uint amountGet, address tokenGive, uint amountGive, address get, address give

    fetchEtherdeltaTrades(address){

        let contract = web3.eth.contract(etherdeltaABI).at(config.etherdelta.contract.live[0].address);

        return new Promise((resolve, reject) => {
            contract.Trade({}, {
                fromBlock: config.etherdelta.contract.live[0].block_start,
                toBlock: config.etherdelta.contract.live[0].block_end}).get( (error, logs) => {
                if(!error){
                    for(let i = 0; i < logs.length; i++){
                        if(logs[i].args.get === address.name || logs[i].args.give ){
                            console.log(logs[i].args);
                        }
                    }
                    resolve();
                }else {
                    console.debug('Cannot fetch issued trades');
                    reject();
                }
            });
        });
    }
    fetchEtherdeltaTradesFromAllContracts(address){

        var allPromises = [];

        const allContracts = config.etherdelta.contract.live;

        for(let i=0;i < allContracts.length;i++) {
            let contract = web3.eth.contract(etherdeltaABI).at(allContracts[i].address);

            allPromises.push(new Promise((resolve, reject) => {
                contract.Trade({},
                    {
                        fromBlock: config.etherdelta.contract.live[i].block_start,
                        toBlock: config.etherdelta.contract.live[i].block_end
                    }).get((error, logs) => {
                    if (!error) {
                        for(let i = 0; i < logs.length; i++){
                            if(logs[i].args.get === address.name || logs[i].args.give === address.name){
                                console.log(logs[i]);
                            }
                        }
                        resolve();
                    } else {
                        reject();
                    }
                });
            }));
        }

        return allPromises;
    }

    fetchAcceptedTrades(address){
        return new Promise((resolve, reject) => {
            this.state.oasis.LogTake({maker: address.name}, {
                fromBlock: config.oasis.contract.kovan.blockNumber,
                toBlock: 'latest'}).get( (error, makeLogs) => {
                if(!error){
                    for(let i=0;i < makeLogs.length; i++){
                        this.addTrade(address, makeLogs[i].args);
                    }
                    resolve();
                }else {
                    console.debug('Cannot fetch issued trades');
                    reject();
                }
            });
        });
    }


    fetchIssuedTradesFor(address) {
        return new Promise((resolve, reject) => {
            this.state.oasis.LogTake({taker: address.name}, {
                fromBlock: config.oasis.contract.kovan.blockNumber,
                toBlock: 'latest'}).get( (error, takeLogs) => {
                if(!error){
                    for(let i = 0; i < takeLogs.length; i++){
                        this.addTrade(address, takeLogs[i].args);
                    }
                    resolve();
                }else {
                    console.debug('Cannot fetch issued trades');
                    reject();
                }
            });
        });
    }

    addTrade(account, log){

        let giveAmount;
        let takeAmount;
        let haveTokenAddress;
        let wantTokenAddress;

        console.log(log);

                //if legacy markets
                if ( typeof log.giveAmount === 'string' ){
                    giveAmount = web3.fromWei(new BN(log.giveAmount, 16).toString(10));
                    takeAmount = web3.fromWei(new BN(log.takeAmount, 16).toString(10));

                    haveTokenAddress = EthUtils.addHexPrefix(log.giveAmount);
                    wantTokenAddress = EthUtils.addHexPrefix(log.takeAmount);
                }else{
                    giveAmount = web3.fromWei(log.giveAmount.toString(10));
                    takeAmount = web3.fromWei(log.takeAmount.toString(10));

                    haveTokenAddress = log.haveToken;
                    wantTokenAddress = log.wantToken;
                }



        let timestamp = new Date(log.timestamp * 1000).toLocaleString();

        const wantToken = config.oasis.tokens.live[wantTokenAddress];
        const haveToken = config.oasis.tokens.live[haveTokenAddress];

        console.log(wantTokenAddress);
        console.log(haveTokenAddress);

        let trade = {
            'Type'     : 'Trade',
            'Buy'      : giveAmount,
            'Buy_Cur' : wantToken,
            'Sell'     : takeAmount,
            'Sell_Cur': haveToken,
            'Fee'      : '',
            'Fee_Cur' : '',
            'Exchange' : '',
            'Group'    : '',
            'Comment'  : account.name,
            'Date'     : timestamp,
        };

        //add trade to CSV
        this.JSONToCSVConverter(trade);

        account.trades.push(trade);
        let newService = this.props.services;
        this.props.addAccount(newService);
    }

    initCSVHeader(){

        let header = config.csv.header;

        let CSV = '';
        let row = '';

            for (let i in header) {
                row += '"' + header[i] + '",' ;
            }

            row = row.slice(0, -1);

            //append Label row with line break
            CSV += row + '\r\n';

        return CSV;
    }

    JSONToCSVConverter(JSONData) {

        let csvEdited = this.state.csv;
        let row = '';

        //If JSONData is not an object then JSON.parse will parse the JSON string in an Object
        let arrData = typeof JSONData != 'object' ? JSON.parse(JSONData) : JSONData;

            //2nd loop will extract each column and convert it in string comma-seprated
            for (let i in arrData) {
                row += '"' + arrData[i] + '",';
            }

            row = row.slice(0, row.length - 1);

            //add a line break after each row
            csvEdited += row + '\r\n';

        this.setState({
            csv: csvEdited,
        });

    }

    downloadCSV() {

        console.log(this.state.csv);
        const fileName = config.csv.title;


        //Initialize file format you want csv or xls
        var uri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(this.state.csv);

        // Now the little tricky part.
        // you can use either>> window.open(uri);
        // but this will not work in some browsers
        // or you will not get the correct file extension

        //this trick will generate a temp <a /> tag
        const link = document.createElement("a");
        link.href = uri;

        //set the visibility hidden so it will not effect on your web-layout
        link.style = "visibility:hidden";
        link.download = fileName + ".csv";

        //this part will append the anchor tag and remove it after automatic click
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}



export default createContainer(({services}) => {
    return {
        services: services,
    }
}, GenerateReportPage);

GenerateReportPage.PropTypes = {
    services: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.number.isRequired,
            accounts: PropTypes.array.isRequired,
            provider: PropTypes.string.isRequired,
            type: PropTypes.string.isRequired,
            url: PropTypes.string.isRequired,
            options: PropTypes.arrayOf(
                PropTypes.shape({
                    active: PropTypes.bool.isRequired,
                    option: PropTypes.string.isRequired,
                })
            ).isRequired
        })).isRequired,
    addAccount: PropTypes.func.isRequired,
};