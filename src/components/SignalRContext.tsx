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

        newConnection.start().then(function () {
            console.log("connected")
        }).catch(function (err) {
            return console.error(err.toString());
        });

        newConnection.onclose(() => {
            console.log('connection closed');
            // Attempt to reconnect after 5 seconds
            setTimeout(() => {
                newConnection.start().then(() => {
                    console.log('reconnected');
                }).catch((error) => {
                    console.error('reconnect failed:', error);
                });
            }, 5000);
        });

        setConnection(newConnection);

        return () => {
            if (connection) {
                connection.off("close");
            }
        };
    }, []);

    if (!connection) return null; 
    return (
        <SignalRContext.Provider value={connection}>
            {children}
        </SignalRContext.Provider>
    );
};
