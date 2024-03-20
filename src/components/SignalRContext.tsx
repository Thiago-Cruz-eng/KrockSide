import React, { createContext, useContext, useState, useEffect } from 'react';
import * as signalR from "@microsoft/signalr";

const SignalRContext = createContext<signalR.HubConnection | null>(null);

export const useSignalR = (): signalR.HubConnection | null => useContext(SignalRContext);

export const SignalRProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
    const [connection, setConnection] = useState<signalR.HubConnection | null>(null);

    useEffect(() => {
        const newConnection = new signalR.HubConnectionBuilder()
            .withUrl("https://localhost:44380/chesshub")
            .build();

        setConnection(newConnection);
        newConnection.start().then(function () {
            console.log("connected")
        }).catch(function (err) {
            return console.error(err.toString());
        });

        newConnection.onclose(function(){
            console.log('connecition closed');
        });

        return () => {
            if (connection) {

            }
        };
    }, []);

    if (!connection) return null; // Return null if connection is not yet established

    return (
        <SignalRContext.Provider value={connection}>
            {children}
        </SignalRContext.Provider>
    );
};
