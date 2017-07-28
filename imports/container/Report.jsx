import React, {Component}  from 'react';
import Services from '../components/services';
import {Link} from 'react-router-dom';
import config from '../config.json';
import oasisABI from '../abi_oasis.json';
import etherdeltaABI from '../abi_etherdelta.json';
import {createContainer} from 'meteor/react-meteor-data';
import Web3 from 'web3';
import { connect } from "react-redux";
import {getLegacyTrades} from "../actions/tradesActions";


class Report extends Component {

    constructor(props) {
        super(props);

        this.initWeb3();
        this.state = {
            csv: this.initCSVHeader(),
            oasis: Report.getSimpleMarketContract().at(config.oasis.contract.live.address),
            hasPayed: false,
            isLoading: false,

        };
    }

    render() {
        return (
            <div>
                <div className="panel panel-default">
                    <div className="panel-heading">
                        Generate Report
                    </div>
                    <Services
                        providers={this.props.providers}
                        removeAccount={this.props.removeAccount}
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


    generateButton() {

        let className;
        let buttonName;
        let buttonFunction;

        if (this.state.hasPayed) {
            className = 'btn btn-primary btn-download';
            buttonName = 'Download';
            buttonFunction = this.downloadCSV.bind(this);
        } else {
            className = 'btn btn-primary btn-generate';
            buttonName = 'Generate';
            buttonFunction = this.fetchData.bind(this)
        }
        return (
            <button
                type="button"
                onClick={buttonFunction}
                className={className}>
                    {buttonName}
            </button>);
    }


    static getSimpleMarketContract() {
        return web3.eth.contract(oasisABI);
    }

    fetchData() {
        this.props.getLegacyTrades(this.props.providers.ethereum.accounts[0]);
        /*
        this.setLoading(true);

        let ethAccounts = this.props.providers.ethereum.accounts;


        let deltaPromises = [];
        let oasisPromises = [];


        for (let i = 0; i < ethAccounts.length; i++) {

            if(this.props.options[0].active){
         //      oasisPromises.push(this.fetchAcceptedTrades(ethAccounts[i]));
         //       oasisPromises.push(this.fetchIssuedTradesFor(ethAccounts[i]));
                oasisPromises.push(this.fetchLegacyTrades(ethAccounts[i]));
            }

            if(this.props.options[1].active){
         //       this.fetchEtherdeltaTradesFromAllContracts(ethAccounts[i], deltaPromises);
            }
        }
        this.fetch(oasisPromises, deltaPromises);
        */
    }



    fetch(oasisPromises, deltaPromises){
        Promise.all(oasisPromises)
            .then(() => {
            return Promise.all(deltaPromises);
          }).then((data) => {
            return Promise.all(this.fetchAllTimeStampsFromEtherdelta(data));
          }).then((data) => {
     //       this.addEtherDeltaTrades(data);
            this.setLoading(false);
            this.hasPayed(true);
        });
    }

    setLoading(bool) {
        this.setState({
            isLoading: bool,
        });
    }

    hasPayed(bool){
        this.setState({
            hasPayed: bool,
        });
    }


    // address tokenGet, uint amountGet, address tokenGive, uint amountGive, address get, address give

    fetchEtherdeltaTradesFromAllContracts(account, promises) {

        const allContracts = config.etherdelta.contract.live;

        for (let i = 0; i < allContracts.length; i++) {
            let contract = web3.eth.contract(etherdeltaABI).at(allContracts[i].address);

            promises.push(new Promise((resolve, reject) => {
                contract.Trade({},
                    {
                        fromBlock: config.etherdelta.contract.live[i].block_start,
                        toBlock: config.etherdelta.contract.live[i].block_end
                    }).get((error, logs) => {
                    if (!error) {
                        let trades = [];
                        for (let i = 0; i < logs.length; i++) {
                            if (logs[i].args.get === account.name || logs[i].args.give === account.name) {
                                let trade = {
                                    acc: account,
                                    log: logs[i],
                                };

                                trades.push(trade);
                            }
                        }
                        resolve(trades);
                    } else {
                        reject();
                    }
                });
            }));
        }
    }

    fetchAllTimeStampsFromEtherdelta(data) {

        let timeStampPromises = [];

        for (let i = 0; i < data.length; i++) {
            for (let j = 0; j < data[i].length; j++) {
                timeStampPromises.push(
                    new Promise((resolve, reject) => {
                        web3.eth.getBlock(data[i][j].log.blockNumber, function (error, result) {
                            if (!error) {
                                console.log(result);
                                let trade = {
                                    account: data[i][j].acc,
                                    log: data[i][j].log,
                                    timestamp: result.timestamp
                                };
                                resolve(trade);
                            } else {
                                console.error(error);
                                reject();
                            }
                        });
                    })
                );
            }
        }
        return timeStampPromises;
    }

    fetchAcceptedTrades(address) {
        return new Promise((resolve, reject) => {
            this.state.oasis.LogTake({maker: address.name}, {
                fromBlock: config.oasis.contract.live.blockNumber,
                toBlock: 'latest'
            }).get((error, makeLogs) => {
                if (!error) {
                    for (let i = 0; i < makeLogs.length; i++) {
                        this.addOasisTradeFor(address, makeLogs[i].args);
                    }
                    resolve();
                } else {
                    console.debug('Cannot fetch issued trades');
                    reject();
                }
            });
        });
    }


    fetchIssuedTradesFor(address) {
        return new Promise((resolve, reject) => {
            this.state.oasis.LogTake({taker: address.name}, {
                fromBlock: config.oasis.contract.live.blockNumber,
                toBlock: 'latest'
            }).get((error, takeLogs) => {
                if (!error) {
                    for (let i = 0; i < takeLogs.length; i++) {
                        this.addOasisTradeFor(address, takeLogs[i].args);
                    }
                    resolve();
                } else {
                    console.debug('Cannot fetch issued trades');
                    reject();
                }
            });
        });
    }



    addEtherDeltaTrades(data) {

        for (let i = 0; i < data.length; i++) {

            let giveAmount = web3.fromWei(data[i].log.args.amountGive.toString(10));
            let takeAmount = web3.fromWei(data[i].log.args.amountGet.toString(10));
            let haveTokenAddress = data[i].log.args.tokenGive;
            let wantTokenAddress = data[i].log.args.tokenGet;
            timestamp = new Date(data[i].timestamp * 1000).toLocaleString();

            const baseCurrency = config.etherdelta.baseCurrency;

            let wantToken;
            let haveToken;

            if (wantTokenAddress === baseCurrency) {
                console.log('bid');
                wantToken = config.etherdelta.tokens[haveTokenAddress];
                haveToken = config.etherdelta.tokens[wantTokenAddress];
            } else if (haveTokenAddress === baseCurrency) {
                console.log('ask');
                wantToken = config.etherdelta.tokens[wantTokenAddress];
                haveToken = config.etherdelta.tokens[haveTokenAddress];
            }


            if (typeof wantToken === 'undefined') {
                wantToken = data[i].log.args.tokenGet;
            }
            if (typeof haveToken === 'undefined') {
                haveToken = data[i].log.args.tokenGive;
            }


            let trade = {
                'Type': 'Trade',
                'Buy': giveAmount,
                'Buy_Cur': wantToken,
                'Sell': takeAmount,
                'Sell_Cur': haveToken,
                'Fee': '',
                'Fee_Cur': '',
                'Exchange': 'Etherdelta.github.io',
                'Group': '',
                'Comment': data[i].account.name,
                'Date': timestamp,
            };

            console.log(trade);

            //add trade to CSV
            this.addTradeToCSV(trade);
            data[i].account.trades.push(trade);
        }
        let newService = this.props.services;
        this.props.addAccount(newService);
    }

    initWeb3(){
        if (typeof web3 !== 'undefined') {
            web3 = new Web3(web3.currentProvider);
        } else {
            // set the provider you want from Web3.providers
            web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
            console.log("new");
        }
    }

    initCSVHeader() {

        let header = config.csv.header;

        let CSV = '';
        let row = '';

        for (let i in header) {
            row += '"' + header[i] + '",';
        }

        row = row.slice(0, -1);

        //append Label row with line break
        CSV += row + '\r\n';

        return CSV;
    }

    addTradeToCSV(trade) {

        let csvEdited = this.state.csv;
        let row = '';

        let tradeData;

        if(typeof trade !== 'object'){
            tradeData = JSON.parse(trade);
        }else {
            tradeData = trade;
        }

        for (let i in tradeData) {
            row += '"' + tradeData[i] + '",';
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

        var uri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(this.state.csv);

        const link = document.createElement("a");
        link.href = uri;

        link.style = "visibility:hidden";
        link.download = fileName + ".csv";

        //this part will append the anchor tag and remove it after automatic click
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}


const mapStateToProps = (state) => {
    return {
        providers: state.providers,
        options: state.settings.options
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        getLegacyTrades: (address) => {
            dispatch(getLegacyTrades(address));
        }
    }
};

export default connect(mapStateToProps,mapDispatchToProps)(Report);