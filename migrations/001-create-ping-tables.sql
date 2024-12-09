-- Create the ping table
CREATE TABLE ping (
    id TEXT PRIMARY KEY,
    client_start_time TIMESTAMPTZ NOT NULL,
    pg_insert_time TIMESTAMPTZ DEFAULT NOW()
);

-- Create the ping_results table
CREATE TABLE ping_results (
    ping_id TEXT PRIMARY KEY REFERENCES ping(id),
    client_start_time TIMESTAMPTZ NOT NULL,
    api_start_time TIMESTAMPTZ NOT NULL,
    api_end_insert_time TIMESTAMPTZ NOT NULL,
    api_return_time TIMESTAMPTZ NOT NULL,
    pg_time TIMESTAMPTZ NOT NULL,
    electric_arrive_time TIMESTAMPTZ NOT NULL,
    client_end_time TIMESTAMPTZ NOT NULL
);
