package com.appsmith.server;

import org.springframework.boot.Banner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Import;
import org.springframework.scheduling.annotation.EnableScheduling;

import com.appsmith.caching.CachingConfig;

@SpringBootApplication()
@EnableScheduling
public class ServerApplication {

    public static void main(String[] args) {
        // new SpringApplicationBuilder(ServerApplication.class)
        //         .bannerMode(Banner.Mode.OFF)
        //         .run(args);
        SpringApplication.run(ServerApplication.class, args);
    }

}
