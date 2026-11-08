# Simulation behavior and limits

Branch illustrates communication and failures in an architecture. Trace and Traffic share a
pure call planner; it is not a load, capacity, or production-performance simulator.

## Calls and responses

Outgoing synchronous calls run in parallel. Each returns as soon as its own dependency chain
finishes. There is no barrier across all graph levels and no global reversed return sweep.
Separate branches can call the same dependency; cycle prevention applies to each call branch.

For example, a collaboration service's Redis call can return before its document-storage call.
The collaboration service's own reply still waits for every synchronous dependency drawn from
it. Mark persistence asynchronous if the intended design acknowledges without waiting for it.
WebSocket describes a transport here, not application-specific acknowledgment or fan-out rules.
A synchronous cache-to-database edge remains a blocking read-through dependency; Branch does
not assume that every cache lookup is a hit.

Queue and stream nodes acknowledge enqueue acceptance before their consumers finish. A failed
enqueue to a down broker is an error. Accepted deliveries are retained by that queue/stream
while a consumer or its synchronous dependency is down, then retried after recovery. The model
assumes queue/log retention through temporary outages; it does not model disk loss, expiry,
duplicate side effects, acknowledgment modes, or exactly-once guarantees. Event buses and other
one-way/async senders do not automatically buffer and replay messages.

## Illustrative timing

An explicit finite, nonnegative edge `latencyMs`, including zero, overrides the default.
Otherwise the destination's node role selects a symmetric per-hop timing assumption:

| Destination role                                                                | Default |
| ------------------------------------------------------------------------------- | ------- |
| Cache, state store, client storage                                              | 2 ms    |
| DNS, CDN, load balancer, gateway, proxy, rate limiter, queue, stream, event bus | 5 ms    |
| Database, NoSQL, search, vector/graph/time-series DB, feature store             | 10 ms   |
| Worker, ETL                                                                     | 40 ms   |
| Object storage, data lake, warehouse, backup                                    | 50 ms   |
| Other recognized architecture roles                                             | 20 ms   |
| Missing or unknown role                                                         | 100 ms  |

These are teaching defaults, not benchmarks for Redis, PostgreSQL, a cloud product, or a network.
They combine interaction costs into one hop; CPU processing and network transit are not separate
resources. Displayed latency uses model milliseconds. Animations compress those times
logarithmically so fast and slow interactions remain distinguishable and readable.

Traffic request latency ends at the caller's response, excluding detached background work. Trace
latency is the latest forward arrival; round-trip latency is the originating caller's completion.
The highlighted slowest edge reflects configured/default hop delay, not measured saturation.
Step mode and sequence export remain graph-traversal aids, not application execution programs.

## Other limits

- Every outgoing connection participates; Branch does not infer which API operation uses it.
- Each Traffic request captures topology and failure state when planned. Changes affect later
  requests; already planned requests do not dynamically re-evaluate failures during transit.
- Animation count is bounded for readability. Counters describe illustrative requests, not RPS
  capacity, load, or a service-level objective.
- Excessive fan-out or call depth pauses playback with an explanation. Plans are never silently
  truncated into successful requests. Traffic log entries appear after the full animated request,
  including its background work, finishes; the displayed request latency excludes that work.
- Blast radius and Chaos show graph reachability/partitions. They do not predict failover,
  resource overload, database consistency, or business-operation availability.
- Simulation state is ephemeral. Diagram edits, saved documents, and undo history are unaffected.
