import { useState } from "react";
import {
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Input,
  Label,
  Modal,
  TextField,
} from "react-aria-components";
import { v4 as uuidv4 } from "uuid";
import { isChangeMessage, ShapeStream } from "@electric-sql/client";

interface PingData {
  ping_id: string;
  client_start_time: string;
  request_sent_at: number;
  response_received_at: number;
  pg_time_offset: number;
  electric_arrive_offset: number;
  client_end_offset: number;
  db_insert_time: number;
}
const stream = new ShapeStream({
  url: new URL("/shape-proxy/ping", import.meta.env.VITE_API_URL).toString(),
});

function App() {
  const [isOpen, setOpen] = useState(false);
  const [pingData, setPingData] = useState<Partial<PingData> | null>(null);
  const [electricArriveTime, setElectricArriveTime] = useState("");

  const handlePing = async () => {
    const ping_id = uuidv4();
    const start = Date.now();
    const client_start_time = new Date(start).toISOString();

    // Record exact time before sending request
    const request_sent_at = Date.now() - start;
    let response_received_at: number;
    let client_end_time: number;

    // Send initial ping
    const responsePromise = fetch(
      new URL("/v1/ping", import.meta.env.VITE_API_URL),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ping_id,
          client_start_time,
        }),
      },
    ).then(response => {
      response_received_at = Date.now() - start;
      return response.json();
    });
    
    // Record exact time when response is received

    const streamPromise = new Promise((resolve) => {
      stream.subscribe((messages) => {
        console.log({ messages });
        messages.forEach((message) => {
          if (isChangeMessage(message) && message.value.id === ping_id) {
            client_end_time = Date.now() - start;
            resolve();
          }
        });
      });
    });

    const [{ db_insert_time }] = await Promise.all([responsePromise, streamPromise]);

    const pg_time_offset = Date.now() - start; // This will be replaced with actual ShapeStream data

    // Store the collected data
    setPingData({
      ping_id,
      client_start_time,
      request_sent_at,
      response_received_at,
      pg_time_offset,
      db_insert_time,
      client_end_time
    });

    // Open modal to collect electric_arrive_time
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!pingData || !electricArriveTime) return;

    const client_end_offset =
      Date.now() - new Date(pingData.client_start_time).getTime();
    const electric_arrive_offset =
      new Date(electricArriveTime).getTime() -
      new Date(pingData.client_start_time).getTime();

    const finalData = {
      ...pingData,
      electric_arrive_offset,
      client_end_offset,
    };

    // Send final ping result
    await fetch(new URL("/v1/ping-result", import.meta.env.VITE_API_URL), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(finalData),
    });

    // Reset state
    setOpen(false);
    setPingData(null);
    setElectricArriveTime("");
  };

  return (
    <div className="App">
      <Button onPress={handlePing}>ping</Button>

      <Modal isDismissable isOpen={isOpen} onOpenChange={setOpen}>
        <Dialog>
          <Heading slot="title">Enter Electric Arrive Time</Heading>
          <div>
            {pingData && (
              <div>
                <p>Ping ID: {pingData.ping_id}</p>
                <p>Request Sent: +{pingData.request_sent_at}ms</p>
                <p>Response Received: +{pingData.response_received_at}ms</p>
                <p>DB Insert Time: {pingData.db_insert_time}ms</p>
                <p>Stream update Received: +{pingData.client_end_time}ms</p>
                <p>
                  Round Trip Time:{" "}
                  {pingData.client_end_time - pingData.request_sent_at}ms
                </p>
                <p>PG Time: +{pingData.pg_time_offset}ms</p>
                {electricArriveTime && (
                  <p>
                    Electric Arrive: +
                    {new Date(electricArriveTime).getTime() -
                      new Date(pingData.client_start_time).getTime()}
                    ms
                  </p>
                )}
              </div>
            )}
            <TextField>
              <Label>Electric Arrive Time:</Label>
              <Input
                value={electricArriveTime}
                onChange={(e) => setElectricArriveTime(e.target.value)}
              />
            </TextField>
            <Button onPress={handleSubmit}>Submit</Button>
          </div>
        </Dialog>
      </Modal>
    </div>
  );
}

export default App;
