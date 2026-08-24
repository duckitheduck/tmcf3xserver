const express=require("express");
const cors=require("cors");
const {Pool}=require("pg");

const app=express();
const PORT=process.env.PORT||3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const pool=new Pool({
    connectionString:process.env.DATABASE_URL,
    ssl:{
        rejectUnauthorized:false
    }
});

// Settings
const MAX_MESSAGES=1000;
const RETRY_SECONDS=30;

// Create / update database
async function setupDatabase(){

    await pool.query(`
        CREATE TABLE IF NOT EXISTS announcements(
            id SERIAL PRIMARY KEY,
            message TEXT NOT NULL,
            target_server TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            attempts INTEGER NOT NULL DEFAULT 0,
            locked_until TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            delivered_at TIMESTAMP NULL
        )
    `);

    // Add columns if you already had the old announcements table
    await pool.query(`
        ALTER TABLE announcements
        ADD COLUMN IF NOT EXISTS target_server TEXT
    `);

    await pool.query(`
        ALTER TABLE announcements
        ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    `);

    await pool.query(`
        ALTER TABLE announcements
        ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0
    `);

    await pool.query(`
        ALTER TABLE announcements
        ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP NULL
    `);

    await pool.query(`
        ALTER TABLE announcements
        ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP NULL
    `);

    console.log("Database ready");
}


// Home / health check
app.get("/",(req,res)=>{
    res.send("Roblox message HTTP server online");
});


// ============================================================
// ROBLOX GETS A MESSAGE
// ============================================================

app.get("/announcement",async(req,res)=>{

    const jobId=req.query.jobId;

    if(!jobId){
        return res.status(400).json({
            success:false,
            error:"jobId is required"
        });
    }

    try{

        /*
            Find the oldest message that:

            1. Is pending
            OR
            2. Was being processed but the retry timer expired

            AND

            3. Is targeted to this server
            OR
            4. Is targeted to "all"
        */

        const result=await pool.query(`
            WITH next_message AS(
                SELECT id
                FROM announcements
                WHERE
                    (
                        status='pending'
                        OR
                        (
                            status='processing'
                            AND locked_until IS NOT NULL
                            AND locked_until<NOW()
                        )
                    )
                    AND
                    (
                        target_server IS NULL
                        OR
                        target_server='all'
                        OR
                        target_server=$1
                    )
                ORDER BY id ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            )

            UPDATE announcements
            SET
                status='processing',
                attempts=attempts+1,
                locked_until=NOW()+($2 * INTERVAL '1 second')
            WHERE id IN(
                SELECT id FROM next_message
            )
            RETURNING id,message,target_server,attempts
        `,[jobId,RETRY_SECONDS]);

        if(result.rows.length===0){

            return res.json({
                message:null
            });

        }

        const row=result.rows[0];

        console.log(
            `Sending message #${row.id} to ${row.target_server||"all"} `+
            `(server: ${jobId}, attempt: ${row.attempts})`
        );

        res.json({
            id:row.id,
            message:row.message,
            targetServer:row.target_server||"all",
            attempt:row.attempts
        });

    }catch(err){

        console.error("Error getting announcement:",err);

        res.status(500).json({
            message:null,
            error:"Database error"
        });

    }

});


// ============================================================
// WEBSITE CREATES A MESSAGE
// ============================================================

app.post("/announcement",async(req,res)=>{

    const message=req.body?.message;

    /*
        targetServer can be:

        "all"
        OR
        a Roblox JobId

        If omitted, defaults to "all".
    */

    const targetServer=req.body?.targetServer||"all";

    if(
        typeof message!=="string"||
        message.trim()===""
    ){

        return res.status(400).json({
            success:false,
            error:"Message is required"
        });

    }

    if(typeof targetServer!=="string"){

        return res.status(400).json({
            success:false,
            error:"targetServer must be a string"
        });

    }

    try{

        const result=await pool.query(`
            INSERT INTO announcements(
                message,
                target_server
            )
            VALUES($1,$2)
            RETURNING id
        `,[
            message.trim(),
            targetServer.trim()
        ]);

        // Keep database from growing forever
        await pool.query(`
            DELETE FROM announcements
            WHERE id IN(
                SELECT id
                FROM announcements
                WHERE status='delivered'
                ORDER BY id ASC
                LIMIT GREATEST(
                    (SELECT COUNT(*) FROM announcements)-$1,
                    0
                )
            )
        `,[MAX_MESSAGES]);

        console.log(
            `Announcement #${result.rows[0].id} received `+
            `(target: ${targetServer})`
        );

        res.json({
            success:true,
            id:result.rows[0].id,
            targetServer:targetServer
        });

    }catch(err){

        console.error("Error saving announcement:",err);

        res.status(500).json({
            success:false,
            error:"Database error"
        });

    }

});


// ============================================================
// ROBLOX ACKNOWLEDGES MESSAGE
// ============================================================

app.post("/announcement/ack",async(req,res)=>{

    const id=req.body?.id;
    const jobId=req.body?.jobId;

    if(!id||!jobId){

        return res.status(400).json({
            success:false,
            error:"id and jobId are required"
        });

    }

    try{

        const result=await pool.query(`
            UPDATE announcements
            SET
                status='delivered',
                locked_until=NULL,
                delivered_at=NOW()
            WHERE
                id=$1
                AND
                status='processing'
                AND
                (
                    target_server IS NULL
                    OR
                    target_server='all'
                    OR
                    target_server=$2
                )
            RETURNING id
        `,[id,jobId]);

        if(result.rows.length===0){

            return res.status(404).json({
                success:false,
                error:"Message not found or already acknowledged"
            });

        }

        console.log(
            `Announcement #${id} acknowledged by ${jobId}`
        );

        res.json({
            success:true,
            id:id
        });

    }catch(err){

        console.error("Error acknowledging message:",err);

        res.status(500).json({
            success:false,
            error:"Database error"
        });

    }

});


// ============================================================
// VIEW MESSAGE QUEUE
// ============================================================

app.get("/messages",async(req,res)=>{

    try{

        const result=await pool.query(`
            SELECT
                id,
                message,
                target_server,
                status,
                attempts,
                locked_until,
                created_at,
                delivered_at
            FROM announcements
            ORDER BY id ASC
        `);

        res.json({
            count:result.rows.length,
            messages:result.rows
        });

    }catch(err){

        console.error("Error getting messages:",err);

        res.status(500).json({
            success:false,
            error:"Database error"
        });

    }

});


// ============================================================
// CLEAR MESSAGE QUEUE
// ============================================================

app.delete("/messages",async(req,res)=>{

    try{

        await pool.query(`
            DELETE FROM announcements
        `);

        console.log("Message queue cleared");

        res.json({
            success:true
        });

    }catch(err){

        console.error("Error clearing messages:",err);

        res.status(500).json({
            success:false,
            error:"Database error"
        });

    }

});


// ============================================================
// TEST ROUTE
// ============================================================

app.get("/test",(req,res)=>{
    res.send("Test route works");
});


// ============================================================
// START SERVER
// ============================================================

setupDatabase()
    .then(()=>{

        app.listen(PORT,"0.0.0.0",()=>{
            console.log(
                `Roblox message HTTP server running on port ${PORT}`
            );
        });

    })
    .catch(err=>{

        console.error(
            "Failed to start database:",
            err
        );

    });
